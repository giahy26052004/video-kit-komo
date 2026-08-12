#!/usr/bin/env node
/**
 * youtube_sources.mjs — Phát hiện video MỚI của 1 YouTube channel qua RSS
 * feed công khai (KHÔNG cần API key):
 *   https://www.youtube.com/feeds/videos.xml?channel_id=<id>
 *
 * CHỈ nhận channel_id truyền vào tường minh (không tự dò/khám phá channel
 * khác) — pipeline này chỉ dùng cho channel đã có quyền/giấy phép reup.
 */
import Parser from "rss-parser";
import { execFileSync } from "node:child_process";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0" },
  customFields: { item: [["yt:videoId", "videoId"]] },
});

function extractVideoId(item) {
  if (item.videoId) return item.videoId;
  const m = /\/(?:shorts|watch\?v=)\/?([A-Za-z0-9_-]{6,})/.exec(item.link || "");
  return m ? m[1] : null;
}

/**
 * @param {string} channelId - dạng "UC..."
 * @returns {Promise<Array<{videoId,title,link,publishedAt}>>} mới nhất trước (đúng thứ tự feed)
 */
export async function fetchChannelVideos(channelId) {
  if (!channelId) throw new Error("thiếu channelId");
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const feed = await parser.parseURL(url);
  return (feed.items || [])
    .map((item) => ({
      videoId: extractVideoId(item),
      title: (item.title || "").trim(),
      link: item.link || "",
      publishedAt: item.isoDate || item.pubDate || null,
    }))
    .filter((v) => v.videoId);
}

/**
 * Liệt kê 1 tab ("videos" hoặc "shorts") của channel qua yt-dlp (flat
 * playlist — chỉ lấy metadata, KHÔNG tải video). Khác `fetchChannelVideos`
 * (RSS chỉ thấy ~15 video MỚI NHẤT) — hàm này lấy TOÀN BỘ video/short channel
 * từng đăng, để reup được cả video CŨ (m yêu cầu), không chỉ video mới.
 */
function fetchTab(channelId, tab) {
  const url = `https://www.youtube.com/channel/${channelId}/${tab}`;
  let output;
  try {
    output = execFileSync("yt-dlp", ["--js-runtimes", "node", "--flat-playlist", "-j", "--no-warnings", url], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    });
  } catch (e) {
    console.warn(`[youtube_sources] không liệt kê được tab "${tab}" của channel ${channelId}: ${e.message}`);
    return [];
  }
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const j = JSON.parse(line);
        return {
          videoId: j.id,
          title: (j.title || "").trim(),
          link: j.webpage_url || j.url || `https://www.youtube.com/watch?v=${j.id}`,
          durationSeconds: typeof j.duration === "number" ? j.duration : null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Toàn bộ video + short của 1 channel (không giới hạn số lượng, không chỉ
 * video mới) — dùng cho youtube_pipeline.mjs để dần reup hết cả backlog cũ,
 * kết hợp với state processedVideoIds để không đăng trùng.
 * @param {string} channelId
 * @returns {Array<{videoId,title,link,durationSeconds}>}
 */
export function fetchChannelCatalog(channelId) {
  if (!channelId) throw new Error("thiếu channelId");
  const videos = fetchTab(channelId, "videos");
  const shorts = fetchTab(channelId, "shorts");
  const seen = new Set();
  return [...videos, ...shorts].filter((v) => v.videoId && !seen.has(v.videoId) && seen.add(v.videoId));
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const channelId = arg("channel-id");
  if (!channelId) {
    console.error("usage: youtube_sources.mjs --channel-id <UC...>");
    process.exit(1);
  }
  const videos = await fetchChannelVideos(channelId);
  console.log(JSON.stringify(videos, null, 2));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/youtube_sources.mjs");
if (isMain) main();
