#!/usr/bin/env node
/**
 * build-metadata.mjs
 *
 * Walks <project>/script.json + <project>/workspace/*.wav + captions.json,
 * computes per-slide durationInFrames from actual WAV duration, and emits
 * <project>/metadata.json for Remotion to consume via --props.
 *
 * WAV duration is read from the header (no ffprobe dependency):
 *   data chunk size / byte rate = seconds
 *
 * Usage: node scripts/build-metadata.mjs <project_dir>
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Reads WAV duration via ffprobe.
 *
 * We previously hand-parsed bytes 28/40 of the WAV header but that broke on
 * any file with extra chunks before `data` (e.g. LIST/INFO metadata inserted
 * by macOS `say` + ffmpeg), causing duration to be read from a metadata
 * chunk and producing nonsense like 0.5s instead of 5s.
 *
 * ffprobe is already a hard requirement (it ships with ffmpeg, listed in
 * Requirements), so there's no extra install cost.
 */
function wavDurationSeconds(wavPath) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${wavPath}"`,
    { encoding: "utf8" }
  );
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe returned invalid duration for ${wavPath}: ${out}`);
  }
  return seconds;
}

/**
 * Kiểm tra 1 file video có stream video thật + duration > 0 bằng ffprobe.
 * Trả về số giây nếu hợp lệ, hoặc null nếu file thiếu/hỏng — không bao giờ
 * throw, để 1 video lỗi không làm fail cả build-metadata (giống convention
 * warn-and-continue của asset_collector.mjs/prepare_media_assets.mjs).
 */
function probeVideoDurationSeconds(videoPath) {
  if (!fs.existsSync(videoPath)) return null;
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries "stream=codec_type:format=duration" -of csv=p=0 "${videoPath}"`,
      { encoding: "utf8" }
    );
    const lines = out.trim().split("\n").filter(Boolean);
    const hasVideoStream = lines.some((l) => l.trim() === "video");
    const durationLine = lines.find((l) => /^[\d.]+$/.test(l.trim()));
    const seconds = durationLine ? parseFloat(durationLine) : NaN;
    if (!hasVideoStream || !Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  } catch (e) {
    console.warn(`[build-metadata] ffprobe thất bại trên ${videoPath}: ${e.message}`);
    return null;
  }
}

function main() {
  const project = process.argv[2];
  if (!project) {
    console.error("usage: build-metadata.mjs <project_dir>");
    process.exit(1);
  }

  const script = JSON.parse(
    fs.readFileSync(path.join(project, "script.json"), "utf8")
  );
  const workspace = path.join(project, "workspace");
  const captionsPath = path.join(workspace, "captions.json");
  const captions = fs.existsSync(captionsPath)
    ? JSON.parse(fs.readFileSync(captionsPath, "utf8"))
    : {};

  const fps = script.fps ?? 30;
  const BUFFER_FRAMES = 15; // ~0.5s pad so audio doesn't clip
  const MIN_FRAMES = 45;

  const slides = script.slides.map((slide, i) => {
    const idx = String(i).padStart(2, "0");
    const wav = path.join(workspace, `${idx}.wav`);
    let durationInFrames = MIN_FRAMES;
    let audio;
    if (fs.existsSync(wav)) {
      const seconds = wavDurationSeconds(wav);
      durationInFrames = Math.ceil(seconds * fps) + BUFFER_FRAMES;
      audio = `${idx}.wav`;
    }

    let { mediaType, videoSrc, ...rest } = slide;
    let mediaDurationSeconds;
    if (mediaType === "video" && videoSrc) {
      const seconds = probeVideoDurationSeconds(path.join(workspace, videoSrc));
      if (seconds === null) {
        console.warn(
          `[build-metadata] slide ${idx}: video "${videoSrc}" thiếu/hỏng — hạ về mediaType "image" (dùng imageSrc làm poster).`
        );
        mediaType = undefined;
        videoSrc = undefined;
      } else {
        mediaDurationSeconds = seconds;
      }
    }

    return {
      ...rest,
      ...(mediaType ? { mediaType } : {}),
      ...(videoSrc ? { videoSrc } : {}),
      ...(mediaDurationSeconds ? { mediaDurationSeconds } : {}),
      durationInFrames,
      audio,
      captions: captions[idx] ?? undefined,
    };
  });

  const meta = {
    title: script.title ?? "untitled",
    width: script.width ?? 1080,
    height: script.height ?? 1920,
    fps,
    ...(script.preset ? { preset: script.preset } : {}),
    ...(script.brand ? { brand: script.brand } : {}),
    ...(script.music ? { music: script.music } : {}),
    ...(script.theme ? { theme: script.theme } : {}),
    ...(script.template ? { template: script.template } : {}),
    slides,
  };

  const out = path.join(project, "metadata.json");
  fs.writeFileSync(out, JSON.stringify(meta, null, 2));
  console.log(`→ ${out}`);
  const total = slides.reduce((a, s) => a + s.durationInFrames, 0);
  console.log(`total: ${slides.length} slides, ${total} frames (${(total / fps).toFixed(1)}s)`);
}

main();
