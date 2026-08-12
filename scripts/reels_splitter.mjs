#!/usr/bin/env node
/**
 * reels_splitter.mjs — Chia 1 video gốc (đã tải bằng youtube_downloader.mjs)
 * thành nhiều đoạn ngắn (mặc định 120s), mỗi đoạn: crop 9:16, burn subtitle
 * (transcribe 1 LẦN cho cả video rồi tự cắt/offset phần .srt cho từng đoạn —
 * đỡ tốn hơn transcribe lại N lần), encode ra file mp4 riêng.
 *
 * Video < 1 đoạn (vd YouTube Shorts đã ngắn) -> ra đúng 1 clip = gần như
 * nguyên video (chỉ crop/encode lại), không có gì đặc biệt cần xử lý riêng.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIN_LAST_SEGMENT_SECONDS = 20; // đoạn cuối ngắn hơn mức này -> gộp vào đoạn trước, tránh clip vài giây vô nghĩa

/** @returns {Array<{index:number, start:number, len:number}>} */
export function computeSegments(durationSeconds, segmentSeconds) {
  const segments = [];
  let start = 0;
  let index = 0;
  while (start < durationSeconds) {
    const remaining = durationSeconds - start;
    const len = Math.min(segmentSeconds, remaining);
    if (len < MIN_LAST_SEGMENT_SECONDS && segments.length > 0) {
      segments[segments.length - 1].len += len; // gộp đoạn cuối ngắn vào đoạn trước
      break;
    }
    segments.push({ index, start, len });
    start += len;
    index++;
  }
  return segments;
}

function parseSrtTimestamp(ts) {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(ts);
  if (!m) return 0;
  const [, h, min, s, ms] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s) + Number(ms) / 1000;
}
function formatSrtTimestamp(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** @returns {Array<{start:number, end:number, text:string}>} */
function parseSrt(srtContent) {
  const blocks = srtContent.replace(/\r/g, "").split(/\n\n+/).filter(Boolean);
  const entries = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [fromStr, toStr] = timeLine.split("-->").map((s) => s.trim());
    const text = lines.slice(lines.indexOf(timeLine) + 1).join("\n");
    entries.push({ start: parseSrtTimestamp(fromStr), end: parseSrtTimestamp(toStr), text });
  }
  return entries;
}

/** Cắt phần phụ đề rơi trong [start, start+len), dịch mốc thời gian về 0. */
function sliceSrtForSegment(entries, start, len) {
  const end = start + len;
  const sliced = entries
    .filter((e) => e.end > start && e.start < end)
    .map((e) => ({ start: Math.max(0, e.start - start), end: Math.min(len, e.end - start), text: e.text }));
  return sliced
    .map((e, i) => `${i + 1}\n${formatSrtTimestamp(e.start)} --> ${formatSrtTimestamp(e.end)}\n${e.text}\n`)
    .join("\n");
}

/**
 * ffmpeg filtergraph coi ':' là ký tự phân tách option -> đường dẫn Windows
 * tuyệt đối (có "C:") escape kiểu \: hay bị parse sai lẫn với filter khác
 * trong cùng chuỗi -vf (đã gặp lỗi thật lúc test). Cách chắc chắn nhất: dùng
 * đường dẫn TƯƠNG ĐỐI so với cwd (ffmpeg chạy đúng cwd hiện tại, không có
 * ổ đĩa "C:" trong path tương đối) rồi mới escape ':' còn sót (phòng hờ).
 */
function escapeForFfmpegFilter(absPath) {
  const rel = path.relative(process.cwd(), absPath) || absPath;
  return rel.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * Transcribe TOÀN BỘ video 1 lần (bỏ qua nếu `full.srt` đã có sẵn từ lần
 * chạy trước — quan trọng vì mỗi lần chạy pipeline chỉ cắt 1 đoạn, không
 * muốn transcribe lại cả video mỗi lần). Lỗi -> trả [] (clip sẽ không có
 * subtitle), KHÔNG throw.
 * @returns {Array<{start:number, end:number, text:string}>}
 */
export function transcribeFull(videoPath, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  const fullSrtPath = path.join(workDir, "full.srt");
  if (!fs.existsSync(fullSrtPath)) {
    console.log("[reels_splitter] transcribe toàn bộ video 1 lần...");
    try {
      execFileSync(process.env.PYTHON || "python", [path.join(SCRIPTS_DIR, "whisper_srt.py"), videoPath, fullSrtPath], {
        stdio: "inherit",
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
    } catch (e) {
      console.warn(`[reels_splitter] transcribe thất bại (${e.message}) -> clip sẽ không có subtitle.`);
    }
  }
  return fs.existsSync(fullSrtPath) ? parseSrt(fs.readFileSync(fullSrtPath, "utf8")) : [];
}

/**
 * Cắt ĐÚNG 1 đoạn (không cắt hết N đoạn cùng lúc — video dài x nhiều đoạn sẽ
 * vượt timeout CI nếu cắt hết 1 lần; xem youtube_pipeline.mjs, mỗi lần chạy
 * chỉ gọi hàm này 1 lần cho đúng đoạn cần đăng tiếp theo). Bỏ qua cắt lại nếu
 * file output đã tồn tại (an toàn khi retry cùng đoạn).
 * @param {string} videoPath - file gốc đã tải
 * @param {string} workDir - thư mục ghi file trung gian + output (tuyệt đối)
 * @param {{index:number, start:number, len:number}} seg - từ computeSegments()
 * @param {Array<{start:number, end:number, text:string}>} fullEntries - từ transcribeFull()
 * @returns {{path:string, index:number, startSec:number, endSec:number}}
 */
export function cutSegment(videoPath, workDir, seg, fullEntries) {
  const outPath = path.join(workDir, `reel-${String(seg.index + 1).padStart(3, "0")}.mp4`);
  if (fs.existsSync(outPath)) {
    console.log(`[reels_splitter] đoạn ${seg.index + 1} đã cắt sẵn (${outPath}), dùng lại.`);
    return { path: outPath, index: seg.index, startSec: seg.start, endSec: seg.start + seg.len };
  }

  const segSrt = sliceSrtForSegment(fullEntries, seg.start, seg.len);
  const cropScale = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920,setsar=1";
  let vf = cropScale;

  if (segSrt.trim()) {
    const segSrtPath = path.join(workDir, `reel-${String(seg.index + 1).padStart(3, "0")}.srt`);
    fs.writeFileSync(segSrtPath, segSrt, "utf8");
    vf += `,subtitles=${escapeForFfmpegFilter(path.resolve(segSrtPath))}`;
  }

  console.log(`[reels_splitter] cắt đoạn ${seg.index + 1} (${seg.start}s -> ${seg.start + seg.len}s)...`);
  const runFfmpeg = (vfArg) =>
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-ss", String(seg.start),
        "-i", videoPath,
        "-t", String(seg.len),
        "-vf", vfArg,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        outPath,
      ],
      { stdio: "inherit" }
    );
  try {
    runFfmpeg(vf);
  } catch (e) {
    if (vf !== cropScale) {
      // ffmpeg build thiếu libass (filter "subtitles" lỗi) -> thử lại KHÔNG
      // burn subtitle, còn hơn bỏ luôn cả clip. Không retry nếu lỗi này
      // không liên quan subtitle (vd input hỏng) — vẫn throw để thấy lỗi thật.
      console.warn(`[reels_splitter] ffmpeg lỗi với filter subtitles (${e.message}) -> thử lại KHÔNG burn subtitle.`);
      runFfmpeg(cropScale);
    } else {
      throw e;
    }
  }
  return { path: outPath, index: seg.index, startSec: seg.start, endSec: seg.start + seg.len };
}

/**
 * Cắt HẾT các đoạn cùng lúc — CHỈ dùng cho test/debug thủ công (vd xem thử
 * toàn bộ clip 1 video ngắn). youtube_pipeline.mjs KHÔNG dùng hàm này (dùng
 * transcribeFull + cutSegment cắt dần từng đoạn/lần chạy, xem comment ở trên).
 * @param {string} videoPath
 * @param {string} workDir
 * @param {{ segmentSeconds?: number, durationSeconds: number }} opts
 * @returns {Array<{path:string, index:number, startSec:number, endSec:number}>}
 */
export function splitIntoReels(videoPath, workDir, opts) {
  const segmentSeconds = opts.segmentSeconds ?? 120;
  const fullEntries = transcribeFull(videoPath, workDir);
  const segments = computeSegments(opts.durationSeconds, segmentSeconds);
  return segments.map((seg) => cutSegment(videoPath, workDir, seg, fullEntries));
}
