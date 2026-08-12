#!/usr/bin/env node
/**
 * youtube_downloader.mjs — Tải 1 video YouTube (theo videoId) về file mp4
 * cục bộ qua yt-dlp. CHỈ dùng cho video thuộc channel đã có quyền/giấy phép
 * reup (xem youtube_pipeline.mjs) — script này KHÔNG tự kiểm tra quyền, chỉ
 * thực thi theo videoId được truyền vào.
 *
 * `--js-runtimes node` — máy/CI không có `deno` cài sẵn; yt-dlp hỗ trợ dùng
 * Node (đã có sẵn, không cần cài thêm) làm JS runtime để giải mã signature,
 * tránh warning "extraction without a JS runtime has been deprecated".
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} videoId
 * @param {string} destPath - đường dẫn file mp4 đích (tuyệt đối), thư mục cha tự tạo nếu chưa có
 * @param {{ maxHeight?: number }} opts
 * @returns {{ videoPath: string, durationSeconds: number }}
 */
export function downloadVideo(videoId, destPath, opts = {}) {
  const maxHeight = opts.maxHeight ?? 1080;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (fs.existsSync(destPath)) fs.rmSync(destPath);

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[youtube_downloader] đang tải ${url} -> ${destPath} ...`);
  execFileSync(
    "yt-dlp",
    [
      "--js-runtimes", "node",
      "-f", `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]`,
      "--merge-output-format", "mp4",
      "--no-playlist",
      "-o", destPath,
      url,
    ],
    { stdio: "inherit" }
  );
  if (!fs.existsSync(destPath)) throw new Error(`yt-dlp chạy xong nhưng không thấy file ${destPath}`);

  const durationStr = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", destPath],
    { encoding: "utf8" }
  ).trim();
  const durationSeconds = Math.round(parseFloat(durationStr));
  if (!durationSeconds) throw new Error(`ffprobe không đọc được duration của ${destPath}`);

  console.log(`[youtube_downloader] tải xong, duration ${durationSeconds}s`);
  return { videoPath: destPath, durationSeconds };
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function main() {
  const videoId = process.argv[2];
  const dest = arg("out", `./out/_ytdl-test/${videoId}.mp4`);
  if (!videoId) {
    console.error("usage: youtube_downloader.mjs <videoId> [--out <path.mp4>]");
    process.exit(1);
  }
  const result = downloadVideo(videoId, path.resolve(dest));
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/youtube_downloader.mjs");
if (isMain) main();
