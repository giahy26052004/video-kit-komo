#!/usr/bin/env node
/**
 * media_providers.mjs
 *
 * Tìm + tải video B-roll thật theo keyword, dùng chung 1 interface để sau này
 * cắm thêm provider khác (vd YouTube + yt-dlp) mà không phải sửa nơi gọi.
 *
 * Provider interface:
 *   { name: string,
 *     search(query: string, opts): Promise<Candidate[]>,
 *     download(candidate: Candidate, destDir: string): Promise<{ videoPath, posterPath }> }
 * Candidate: { id, provider, width, height, durationSeconds, downloadUrl, thumbnailUrl }
 *
 * TODO Phase 3: thêm YOUTUBE_PROVIDER (search qua Playwright, tải bằng yt-dlp)
 * vào VIDEO_PROVIDERS bên dưới sau khi Pexels chạy ổn định — xem plan gốc.
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search";
const PEXELS_PHOTO_SEARCH_URL = "https://api.pexels.com/v1/search";

function httpsGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} khi gọi ${url}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON không hợp lệ từ ${url}: ${e.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(res.headers.location, destPath).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`HTTP ${res.statusCode} khi tải ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      })
      .on("error", (e) => {
        file.close();
        fs.rmSync(destPath, { force: true });
        reject(e);
      });
  });
}

/**
 * @param {string} query
 * @param {{ orientation?: string, minDuration?: number, maxDuration?: number, targetWidth?: number }} opts
 */
async function searchPexelsVideo(query, opts = {}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY chưa được set");

  const params = new URLSearchParams({
    query,
    per_page: "15",
    orientation: opts.orientation ?? "portrait",
  });
  const json = await httpsGetJson(`${PEXELS_SEARCH_URL}?${params}`, { Authorization: apiKey });
  const videos = Array.isArray(json.videos) ? json.videos : [];

  return videos
    .filter((v) => {
      if (opts.minDuration && v.duration < opts.minDuration) return false;
      if (opts.maxDuration && v.duration > opts.maxDuration) return false;
      return Array.isArray(v.video_files) && v.video_files.length > 0;
    })
    .map((v) => ({
      id: v.id,
      provider: "pexels",
      width: v.width,
      height: v.height,
      durationSeconds: v.duration,
      videoFiles: v.video_files,
      thumbnailUrl: v.image,
    }));
}

/**
 * Chọn video_file có độ phân giải gần nhất nhưng không vượt quá targetWidth
 * (tránh tải file 4K không cần thiết cho khung 1080x1920).
 */
function pickBestVideoFile(candidate, targetWidth = 1080) {
  const files = [...candidate.videoFiles].sort((a, b) => a.width - b.width);
  const fitting = files.filter((f) => f.width <= targetWidth * 1.5);
  return fitting[fitting.length - 1] ?? files[0];
}

async function downloadPexelsVideo(candidate, destDir, opts = {}) {
  const file = pickBestVideoFile(candidate, opts.targetWidth);
  const videoPath = path.join(destDir, `${candidate.id}.mp4`);
  const posterPath = path.join(destDir, `${candidate.id}-poster.jpg`);
  await downloadFile(file.link, videoPath);
  await downloadFile(candidate.thumbnailUrl, posterPath);
  return {
    videoPath: path.relative(path.dirname(destDir), videoPath).split(path.sep).join("/"),
    posterPath: path.relative(path.dirname(destDir), posterPath).split(path.sep).join("/"),
  };
}

export const PEXELS_PROVIDER = { name: "pexels", search: searchPexelsVideo, download: downloadPexelsVideo };

export const VIDEO_PROVIDERS = [PEXELS_PROVIDER];

/**
 * Ảnh tĩnh (Pexels Photos API, khác endpoint với video ở trên) — dùng cho bài
 * viết Facebook thường (ảnh + chữ, không phải Reel video).
 * @param {string} query
 * @param {{ orientation?: string }} opts
 */
async function searchPexelsPhoto(query, opts = {}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY chưa được set");

  const params = new URLSearchParams({
    query,
    per_page: "15",
    orientation: opts.orientation ?? "landscape",
  });
  const json = await httpsGetJson(`${PEXELS_PHOTO_SEARCH_URL}?${params}`, { Authorization: apiKey });
  const photos = Array.isArray(json.photos) ? json.photos : [];

  return photos
    .filter((p) => p.src && (p.src.large2x || p.src.large || p.src.original))
    .map((p) => ({
      id: p.id,
      provider: "pexels",
      width: p.width,
      height: p.height,
      downloadUrl: p.src.large2x || p.src.large || p.src.original,
    }));
}

async function downloadPexelsPhoto(candidate, destDir) {
  const photoPath = path.join(destDir, `${candidate.id}.jpg`);
  await downloadFile(candidate.downloadUrl, photoPath);
  return { photoPath: path.relative(path.dirname(destDir), photoPath).split(path.sep).join("/") };
}

export const PEXELS_PHOTO_PROVIDER = { name: "pexels", search: searchPexelsPhoto, download: downloadPexelsPhoto };

export const PHOTO_PROVIDERS = [PEXELS_PHOTO_PROVIDER];

/**
 * Tương tự findAndDownloadVideo() nhưng cho ảnh tĩnh — dùng cho bài viết
 * Facebook thường. Trả về null nếu không provider nào ra kết quả (nơi gọi
 * PHẢI tự fallback, không throw để không làm hỏng cả pipeline).
 * @param {string} query
 * @param {string} destDir đường dẫn tuyệt đối
 * @param {{ orientation?: string }} opts
 */
export async function findAndDownloadPhoto(query, destDir, opts = {}) {
  for (const provider of PHOTO_PROVIDERS) {
    try {
      const candidates = await provider.search(query, opts);
      if (!candidates.length) {
        console.warn(`[media_providers] ${provider.name} (photo): không có kết quả cho "${query}"`);
        continue;
      }
      const picked = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
      const result = await provider.download(picked, destDir);
      return { ...result, provider: provider.name };
    } catch (e) {
      console.warn(`[media_providers] ${provider.name} (photo) thất bại: ${e.message} — thử provider kế/bỏ qua ảnh`);
    }
  }
  return null;
}

/**
 * Thử lần lượt từng provider, trả về file đã tải đầu tiên thành công, hoặc
 * null nếu không provider nào ra kết quả — nơi gọi PHẢI tự fallback về ảnh
 * khi nhận null, không được throw để không làm hỏng cả pipeline.
 *
 * @param {string} query
 * @param {string} destDir đường dẫn tuyệt đối, vd `<workspace>/video`
 * @param {{ orientation?: string, minDuration?: number, maxDuration?: number, targetWidth?: number }} opts
 */
export async function findAndDownloadVideo(query, destDir, opts = {}) {
  for (const provider of VIDEO_PROVIDERS) {
    try {
      const candidates = await provider.search(query, opts);
      if (!candidates.length) {
        console.warn(`[media_providers] ${provider.name}: không có kết quả cho "${query}"`);
        continue;
      }
      // Chọn ngẫu nhiên trong top-5 (giống convention research_topic.mjs) để
      // tránh luôn ra đúng 1 clip mỗi lần chạy cùng query.
      const picked = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
      const result = await provider.download(picked, destDir, opts);
      return { ...result, provider: provider.name, durationSeconds: picked.durationSeconds };
    } catch (e) {
      console.warn(`[media_providers] ${provider.name} thất bại: ${e.message} — thử provider kế/bỏ qua video`);
    }
  }
  return null;
}
