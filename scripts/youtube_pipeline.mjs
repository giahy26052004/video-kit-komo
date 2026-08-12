#!/usr/bin/env node
/**
 * youtube_pipeline.mjs — Theo dõi 1 YouTube channel ĐÃ CÓ QUYỀN/GIẤY PHÉP
 * reup: liệt kê TOÀN BỘ video/short của channel qua yt-dlp (`youtube_sources
 * .mjs::fetchChannelCatalog` — không chỉ video MỚI, để dần reup hết cả
 * backlog cũ, dedup qua state nên không đăng trùng), tải về, cắt thành nhiều
 * đoạn ngắn (mặc định 120s/đoạn — video ngắn hơn 1 đoạn, vd YouTube Shorts,
 * ra đúng 1 clip), chuyển 9:16 + burn subtitle, đăng Facebook Reels qua
 * publish_facebook.mjs (tái dùng nguyên trạng, không sửa file đó — tạo thư
 * mục project giả `out/<slug>/{script.json, out/full.mp4}` giống cách
 * news_pipeline.mjs đã làm).
 *
 * NHỊP ĐĂNG: mỗi lần chạy CHỈ CẮT + ĐĂNG ĐÚNG 1 CLIP (mặc định, đổi qua
 * --max-clips) — video dài ra nhiều clip thì đăng dần, mỗi lần chạy (cron 2
 * tiếng/lần) xử lý 1 clip, tiếp tục đúng chỗ ở lần sau (lưu tiến độ trong
 * state.pending). QUAN TRỌNG: KHÔNG cắt sẵn hết N clip ngay từ đầu — video
 * dài (vd 30 phút -> ~15-19 đoạn) mà cắt hết 1 lần có thể tốn hàng giờ CPU,
 * vượt xa timeout của GitHub Actions (job sẽ chết giữa đường, không đăng
 * được gì, và lần sau lại làm lại từ đầu — đã gặp bug này lúc test thật).
 * Nên: bắt đầu video mới -> chỉ download + transcribe (1 lần, rẻ) + TÍNH số
 * đoạn (không cắt), rồi mỗi lần chạy chỉ cutSegment() đúng 1 đoạn cần đăng.
 *
 * CHỈ xử lý channel_id truyền vào tường minh qua --channel-id — không tự dò
 * hay khám phá channel khác. Pipeline này chỉ dành cho channel đã xác nhận
 * có quyền reup, khác hẳn news_pipeline.mjs (viết content mới từ tin tức).
 *
 * State: data/youtube-pipeline-state.json —
 *   { channels: { <channelId>: {
 *       processedVideoIds: [...],           // video đã đăng HẾT clip
 *       pending: null | { videoId, title, link, workDir, originalPath,
 *                          segments: [{index,start,len}], totalClips, nextIndex }
 *   } } }
 * Video mới xử lý qua --dry-run/--skip-publish KHÔNG advance nextIndex/
 * processedVideoIds (để lần chạy thật sau vẫn đăng lại đúng clip đó).
 *
 * Usage: node scripts/youtube_pipeline.mjs --channel-id <UC...>
 *          [--dry-run] [--skip-publish] [--segment-seconds 120] [--max-clips 1]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchChannelCatalog } from "./youtube_sources.mjs";
import { downloadVideo } from "./youtube_downloader.mjs";
import { computeSegments, transcribeFull, cutSegment } from "./reels_splitter.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = path.join(KIT_ROOT, "data", "youtube-pipeline-state.json");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { channels: {} };
  }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function buildCaption(video, index, total) {
  const part = total > 1 ? ` (phần ${index + 1}/${total})` : "";
  return `${video.title}${part}\n\n🔗 ${video.link}`;
}

/**
 * Bắt đầu xử lý 1 video MỚI: tải + transcribe 1 lần + TÍNH số đoạn (KHÔNG
 * cắt clip nào cả — cắt dần từng đoạn ở main(), xem comment đầu file).
 *
 * Video tải THẤT BẠI (vd YouTube chặn IP datacenter CI — "Sign in to confirm
 * you're not a bot", gặp thật lúc test) KHÔNG được đánh dấu processedVideoIds
 * — lỗi này có thể là tạm thời/hạ tầng (không liên quan bản thân video đó),
 * đánh dấu nhầm "đã xử lý" sẽ làm mất video đó khỏi backlog vĩnh viễn dù
 * chưa hề đăng được. Bỏ qua CHỈ trong phạm vi lần chạy này (excludeIds).
 *
 * @returns {"started"|"skip"|"done"}
 */
function startNextVideo(channelId, channelState, segmentSeconds, excludeIds) {
  const videos = fetchChannelCatalog(channelId);
  console.log(`[youtube] channel có ${videos.length} video/short, đã xử lý ${channelState.processedVideoIds.length}.`);
  const next = videos.find((v) => !channelState.processedVideoIds.includes(v.videoId) && !excludeIds.has(v.videoId));
  if (!next) return "done";

  console.log(`\n[video] bắt đầu "${next.title}" (${next.videoId})`);
  const workDir = path.join(KIT_ROOT, "out", `_yt-${next.videoId}`);
  const originalPath = path.join(workDir, "original.mp4");

  let downloadResult;
  try {
    downloadResult = downloadVideo(next.videoId, originalPath);
  } catch (e) {
    console.error(`  tải video thất bại (${e.message}) -> bỏ qua video này CHO LẦN CHẠY NÀY (không đánh dấu processed — có thể lỗi tạm thời/hạ tầng, không phải do video này thật sự lỗi).`);
    fs.rmSync(workDir, { recursive: true, force: true });
    excludeIds.add(next.videoId);
    return "skip";
  }

  transcribeFull(originalPath, workDir); // ghi workDir/full.srt 1 lần, dùng lại ở mọi lần chạy sau
  const segments = computeSegments(downloadResult.durationSeconds, segmentSeconds);
  console.log(`  video dài ${downloadResult.durationSeconds}s -> ${segments.length} clip, sẽ đăng dần ${segments.length} lần chạy tới.`);
  channelState.pending = {
    videoId: next.videoId,
    title: next.title,
    link: next.link,
    workDir,
    originalPath,
    segments,
    totalClips: segments.length,
    nextIndex: 0,
  };
  return "started";
}

async function main() {
  const channelId = arg("channel-id");
  if (!channelId) {
    console.error("usage: youtube_pipeline.mjs --channel-id <UC...> [--dry-run] [--skip-publish] [--segment-seconds 120] [--max-clips 1]");
    process.exit(1);
  }
  const segmentSeconds = Number(arg("segment-seconds", "120"));
  const maxClips = Number(arg("max-clips", "1"));
  const dryRun = process.argv.includes("--dry-run");
  const skipPublish = process.argv.includes("--skip-publish");

  const state = loadState();
  state.channels[channelId] = state.channels[channelId] || { processedVideoIds: [], pending: null };
  const channelState = state.channels[channelId];

  const MAX_DOWNLOAD_ATTEMPTS = 3; // chặn lỗi hạ tầng lặp (vd IP bị YouTube chặn) khỏi cày hết cả catalog trong 1 lần chạy
  const skippedThisRun = new Set();
  let downloadAttempts = 0;

  let clipsPosted = 0;
  while (clipsPosted < maxClips) {
    if (!channelState.pending) {
      if (downloadAttempts >= MAX_DOWNLOAD_ATTEMPTS) {
        console.error(`[youtube] tải thất bại ${MAX_DOWNLOAD_ATTEMPTS} video liên tiếp -> dừng lần chạy này (nghi lỗi hạ tầng, ví dụ IP bị YouTube chặn), thử lại ở lần chạy sau.`);
        break;
      }
      const result = startNextVideo(channelId, channelState, segmentSeconds, skippedThisRun);
      if (result === "done") {
        console.log("[youtube] hết video/short chưa xử lý.");
        saveState(state);
        break;
      }
      if (result === "skip") {
        downloadAttempts++;
        continue; // thử video kế tiếp, KHÔNG lưu state (video vừa skip không bị đánh dấu processed)
      }
      saveState(state); // result === "started"
    }

    const pending = channelState.pending;
    const clipNum = pending.nextIndex + 1;
    const seg = pending.segments[pending.nextIndex];

    let clipPath;
    try {
      const fullEntries = transcribeFull(pending.originalPath, pending.workDir); // đọc lại full.srt đã có, không transcribe lại
      clipPath = cutSegment(pending.originalPath, pending.workDir, seg, fullEntries).path;
    } catch (e) {
      console.error(`  cắt đoạn ${clipNum} thất bại (${e.message}) -> dừng lại, thử lại ở lần chạy sau.`);
      break;
    }

    const slug = `yt-${pending.videoId}-${String(clipNum).padStart(3, "0")}`;
    const caption = buildCaption(pending, pending.nextIndex, pending.totalClips);
    const projectDir = path.join(KIT_ROOT, "out", slug);
    fs.mkdirSync(path.join(projectDir, "out"), { recursive: true });
    fs.copyFileSync(clipPath, path.join(projectDir, "out", "full.mp4"));
    fs.writeFileSync(path.join(projectDir, "script.json"), JSON.stringify({ title: pending.title, fbCaption: caption, slides: [] }, null, 2));

    console.log(`\n[clip] ${slug} (${clipNum}/${pending.totalClips} của "${pending.title}")`);

    if (dryRun) {
      console.log(`  (dry-run) clip sẵn sàng tại out/${slug}/out/full.mp4, dừng lại (không advance tiến độ).`);
      break;
    }
    if (skipPublish) {
      console.log(`  (--skip-publish) clip sẵn sàng tại out/${slug}/out/full.mp4, không đăng (không advance tiến độ).`);
      break;
    }
    if (!process.env.FB_PAGE_ACCESS_TOKEN) {
      console.log("  thiếu FB_PAGE_ACCESS_TOKEN -> dừng lại (không advance tiến độ).");
      break;
    }

    try {
      execFileSync("node", [path.join(KIT_ROOT, "scripts/publish_facebook.mjs"), slug, "--caption", caption], { cwd: KIT_ROOT, stdio: "inherit" });
      fs.rmSync(projectDir, { recursive: true, force: true });
      console.log(`  [${slug}] đã đăng Facebook.`);
    } catch (e) {
      console.error(`  [${slug}] đăng thất bại (${e.message}) -> dừng lại, thử lại đúng clip này ở lần chạy sau.`);
      break;
    }

    clipsPosted++;
    pending.nextIndex++;
    if (pending.nextIndex >= pending.totalClips) {
      console.log(`  video "${pending.title}" đã đăng đủ ${pending.totalClips} clip.`);
      channelState.processedVideoIds.push(pending.videoId);
      if (channelState.processedVideoIds.length > 500) channelState.processedVideoIds = channelState.processedVideoIds.slice(-500);
      fs.rmSync(pending.workDir, { recursive: true, force: true });
      channelState.pending = null;
    }
    saveState(state);
  }

  console.log(`\n[youtube] hoàn tất: đã đăng ${clipsPosted} clip.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
