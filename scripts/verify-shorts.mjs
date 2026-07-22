#!/usr/bin/env node
/**
 * verify-shorts.mjs — objective acceptance gate for the shorts pipeline.
 *
 * asset-version: v0.3.0-rc.1 / 2026-07-22 / verify generated cuts from bound render metadata
 * owner_surface: claude-video-kit / T0580 / shorts acceptance
 * behavior_change: include first/last scenes and prefer a duration-matched render schedule when supplied
 * rollback: omit --metadata to retain visual scene detection; revert this file for legacy interval math
 *
 * Usage:
 *   node scripts/verify-shorts.mjs <path/to/video.mp4> [--metadata <metadata.json>]
 *
 * Hard gates (any failing → exit 1):
 *   1. Canvas is 1080×1920 (vertical 9:16)
 *   2. Duration ≤ 60s (YouTube Shorts / 抖音 hard cap)
 *   3. Average scene-change interval ≤ 3.0s (no slide stays static too long)
 *   4. First 2s contains at least one scene change (hook entrance not static)
 *
 * Soft warnings (printed, don't fail):
 *   - Median scene interval > 2.5s (rhythm slower than viral norm)
 *   - File size > 30MB (consider re-encoding before upload)
 *
 * Out of scope (Phase 2):
 *   - Font height ratio (needs OCR)
 *   - Audio LUFS / loudness consistency
 *
 * Safety: uses spawn() with arg arrays — no shell interpolation, args are
 * passed directly to ffprobe/ffmpeg without going through a shell.
 */

import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { argv, exit } from "node:process";

const SHORTS_WIDTH = 1080;
const SHORTS_HEIGHT = 1920;
const MAX_DURATION_S = 60;
const MAX_AVG_SCENE_INTERVAL_S = 3.0;
const FIRST_HOOK_WINDOW_S = 2.0;

function runArgv(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`${cmd} exit ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.on("error", reject);
  });
}

async function probeMeta(path) {
  const { stdout } = await runArgv("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration,size",
    "-of",
    "json",
    path,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const fmt = data.format ?? {};
  return {
    width: stream.width,
    height: stream.height,
    duration: parseFloat(fmt.duration ?? "0"),
    sizeBytes: parseInt(fmt.size ?? "0", 10),
  };
}

/**
 * Detect scene changes via ffmpeg's scene filter. Returns timestamps (in
 * seconds) where a scene change exceeds the threshold.
 */
async function detectScenes(path, threshold = 0.1) {
  const { stderr } = await runArgv("ffmpeg", [
    "-i",
    path,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-f",
    "null",
    "-",
  ]);
  const ts = [];
  const re = /pts_time:([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    ts.push(parseFloat(m[1]));
  }
  return ts;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function loadRenderSchedule(path, videoMeta) {
  let data;
  try {
    data = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`invalid render metadata: ${error.message}`);
  }

  const fps = Number(data.fps);
  const slides = data.slides;
  if (!Number.isFinite(fps) || fps <= 0 || !Array.isArray(slides) || slides.length === 0) {
    throw new Error("invalid render metadata: fps and at least one slide are required");
  }
  if (data.width !== videoMeta.width || data.height !== videoMeta.height) {
    throw new Error(
      `render metadata canvas ${data.width}×${data.height} does not match video ${videoMeta.width}×${videoMeta.height}`,
    );
  }

  const durations = slides.map((slide, index) => {
    const frames = Number(slide.durationInFrames);
    if (!Number.isFinite(frames) || frames <= 0) {
      throw new Error(`invalid render metadata: slide ${index} has no positive durationInFrames`);
    }
    return frames;
  });
  const scheduledDuration = durations.reduce((sum, frames) => sum + frames, 0) / fps;
  const tolerance = Math.max(0.25, 2 / fps);
  if (Math.abs(scheduledDuration - videoMeta.duration) > tolerance) {
    throw new Error(
      `render metadata duration ${fmt(scheduledDuration)}s does not match video ${fmt(videoMeta.duration)}s`,
    );
  }

  let elapsedFrames = 0;
  const scenes = [];
  for (const frames of durations.slice(0, -1)) {
    elapsedFrames += frames;
    scenes.push(elapsedFrames / fps);
  }
  return scenes;
}

function sceneIntervals(duration, scenes) {
  const boundaries = [
    0,
    ...scenes
      .filter((time) => Number.isFinite(time) && time > 0 && time < duration)
      .sort((a, b) => a - b),
    duration,
  ];
  const intervals = [];
  for (let i = 1; i < boundaries.length; i++) {
    intervals.push(boundaries[i] - boundaries[i - 1]);
  }
  return intervals;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

async function main() {
  const path = argv[2];
  if (!path) {
    console.error("usage: verify-shorts <video.mp4> [--metadata <metadata.json>]");
    exit(2);
  }
  const metadataPath = optionValue(argv.slice(3), "--metadata");
  if (argv.includes("--metadata") && !metadataPath) {
    console.error("--metadata requires a path");
    exit(2);
  }

  try {
    await stat(path);
  } catch {
    console.error(`file not found: ${path}`);
    exit(2);
  }

  const meta = await probeMeta(path);
  const scenes = metadataPath
    ? await loadRenderSchedule(metadataPath, meta)
    : await detectScenes(path);
  const sceneSource = metadataPath ? "metadata schedule" : "visual detector";

  const intervals = sceneIntervals(meta.duration, scenes);
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const medianInterval = median(intervals);

  const hookSceneCount = scenes.filter((t) => t <= FIRST_HOOK_WINDOW_S).length;

  const failures = [];
  if (meta.width !== SHORTS_WIDTH || meta.height !== SHORTS_HEIGHT) {
    failures.push(
      `canvas ${meta.width}×${meta.height} ≠ ${SHORTS_WIDTH}×${SHORTS_HEIGHT}`,
    );
  }
  if (meta.duration > MAX_DURATION_S) {
    failures.push(
      `duration ${fmt(meta.duration)}s > ${MAX_DURATION_S}s (YouTube Shorts cap)`,
    );
  }
  if (avgInterval > MAX_AVG_SCENE_INTERVAL_S) {
    failures.push(
      `avg scene interval ${fmt(avgInterval)}s > ${MAX_AVG_SCENE_INTERVAL_S}s (too static)`,
    );
  }
  if (hookSceneCount === 0 && meta.duration > FIRST_HOOK_WINDOW_S) {
    failures.push(
      `no scene change in first ${FIRST_HOOK_WINDOW_S}s (static hook = poor retention)`,
    );
  }

  const warnings = [];
  if (medianInterval > 2.5) {
    warnings.push(
      `median scene interval ${fmt(medianInterval)}s > 2.5s (slower than viral norm)`,
    );
  }
  if (meta.sizeBytes > 30 * 1024 * 1024) {
    warnings.push(
      `file size ${fmt(meta.sizeBytes / 1024 / 1024)}MB > 30MB (consider re-encode)`,
    );
  }

  console.log(`# Shorts Verify Report`);
  console.log(`file: ${path}`);
  console.log(``);
  console.log(`canvas: ${meta.width}×${meta.height}`);
  console.log(`duration: ${fmt(meta.duration)}s`);
  console.log(`size: ${fmt(meta.sizeBytes / 1024 / 1024)}MB`);
  console.log(`scene source: ${sceneSource}`);
  console.log(`scenes detected: ${scenes.length}`);
  console.log(`avg interval: ${fmt(avgInterval)}s`);
  console.log(`median interval: ${fmt(medianInterval)}s`);
  console.log(`first-${FIRST_HOOK_WINDOW_S}s scene changes: ${hookSceneCount}`);
  console.log(``);

  if (failures.length === 0) {
    console.log(`✅ PASS (4/4 hard gates)`);
  } else {
    console.log(`❌ FAIL (${failures.length} of 4 hard gates failed)`);
    for (const f of failures) console.log(`  - ${f}`);
  }
  if (warnings.length > 0) {
    console.log(``);
    console.log(`⚠️ Warnings (non-blocking):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  exit(2);
});
