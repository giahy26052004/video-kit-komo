#!/usr/bin/env node
/**
 * publish_facebook.mjs — Đăng 1 video (out/<slug>/out/full.mp4) lên Facebook
 * Page dưới dạng REELS thật (không phải video post thường) qua Graph API
 * 3 bước chuẩn của Facebook:
 *   1. POST /{page-id}/video_reels  upload_phase=start  -> video_id + upload_url
 *   2. POST <upload_url>            upload video nhị phân (header offset/file_size)
 *   3. POST /{page-id}/video_reels  upload_phase=finish, video_state=PUBLISHED
 *
 * Token KHÔNG lưu vào file/git — chỉ truyền qua env FB_PAGE_ACCESS_TOKEN
 * hoặc --token lúc chạy. Ghi lại post id vào out/<slug>/published.json
 * (không ghi token) để biết video nào đã đăng rồi, tránh đăng trùng.
 *
 * Usage:
 *   FB_PAGE_ACCESS_TOKEN=xxx node scripts/publish_facebook.mjs <slug> \
 *     [--page-id 1238372036022307] [--caption "..."] [--dry-run] [--legacy-video]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRAPH_VERSION = "v25.0";
const DEFAULT_PAGE_ID = "1238372036022307"; // KOMO AI

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function buildDefaultCaption(script) {
  const cover = script.slides.find((s) => s.type === "cover" && s.endCard);
  const cta = cover?.endCardCTAs?.[0]?.value;
  // fbCaption (do LLM viết, tự nhiên) ưu tiên hơn title kỹ thuật "owner/repo - X sao".
  const lines = [script.fbCaption || script.title];
  if (cta) {
    // Facebook chỉ auto-link khi có scheme http(s):// đầy đủ, domain trần
    // ("komoapi.site") thường không bấm vào được trong caption.
    const url = /^https?:\/\//i.test(cta) ? cta : `https://${cta}`;
    lines.push(`👉 ${url}`);
  }
  lines.push("#AI #KomoAPI");
  return lines.join("\n\n");
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: publish_facebook.mjs <slug> [--page-id <id>] [--caption <text>] [--dry-run]");
    process.exit(1);
  }

  const projectDir = path.join(KIT_ROOT, "out", slug);
  const videoPath = path.join(projectDir, "out", "full.mp4");
  if (!fs.existsSync(videoPath)) {
    console.error(`video chưa render: ${videoPath}`);
    process.exit(1);
  }

  const script = JSON.parse(fs.readFileSync(path.join(projectDir, "script.json"), "utf8"));
  const pageId = arg("page-id", DEFAULT_PAGE_ID);
  const caption = arg("caption", buildDefaultCaption(script));
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const dryRun = process.argv.includes("--dry-run");

  console.log(`slug: ${slug}`);
  console.log(`page: ${pageId}`);
  console.log(`caption:\n${caption}\n`);

  if (dryRun) {
    console.log("(dry-run) không gọi API thật.");
    return;
  }

  if (!token) {
    console.error("thiếu FB_PAGE_ACCESS_TOKEN (env var) — không đăng.");
    process.exit(1);
  }

  const publishedPath = path.join(projectDir, "published.json");
  if (fs.existsSync(publishedPath)) {
    const prev = JSON.parse(fs.readFileSync(publishedPath, "utf8"));
    console.error(`video này đã đăng rồi lúc ${prev.publishedAt} (post id ${prev.postId}) — dừng để tránh đăng trùng. Xoá ${publishedPath} nếu muốn đăng lại.`);
    process.exit(1);
  }

  const videoBuffer = fs.readFileSync(videoPath);
  const useLegacy = process.argv.includes("--legacy-video");

  const result = useLegacy
    ? await publishAsVideoPost({ pageId, token, videoBuffer, caption })
    : await publishAsReel({ pageId, token, videoBuffer, caption });

  console.log("đăng thành công:", JSON.stringify(result, null, 2));
  fs.writeFileSync(
    publishedPath,
    JSON.stringify({ publishedAt: new Date().toISOString(), pageId, mode: useLegacy ? "video" : "reel", ...result }, null, 2)
  );
}

/** Video post thường (POST /{page-id}/videos) — flow cũ, giữ làm fallback. */
async function publishAsVideoPost({ pageId, token, videoBuffer, caption }) {
  const form = new FormData();
  form.append("source", new Blob([videoBuffer], { type: "video/mp4" }), "full.mp4");
  form.append("description", caption);
  form.append("access_token", token);

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`;
  console.log(`đang upload (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB) lên ${url} (video post thường) ...`);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error("đăng THẤT BẠI:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
  return { postId: data.id ?? null };
}

/**
 * Reels thật — 3 bước chuẩn của Facebook Graph API:
 * start -> upload nhị phân -> finish (video_state=PUBLISHED).
 */
async function publishAsReel({ pageId, token, videoBuffer, caption }) {
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`;

  console.log("bước 1/3: khởi tạo upload session...");
  const startRes = await fetch(`${base}?upload_phase=start&access_token=${encodeURIComponent(token)}`, { method: "POST" });
  const startData = await startRes.json();
  if (!startRes.ok || startData.error) {
    console.error("đăng THẤT BẠI (start):", JSON.stringify(startData, null, 2));
    process.exit(1);
  }
  const { video_id: videoId, upload_url: uploadUrl } = startData;

  console.log(`bước 2/3: upload ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB nhị phân...`);
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(videoBuffer.length),
    },
    body: videoBuffer,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || uploadData.error || uploadData.success === false) {
    console.error("đăng THẤT BẠI (upload):", JSON.stringify(uploadData, null, 2));
    process.exit(1);
  }

  console.log("bước 3/3: publish reel...");
  const finishRes = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      video_id: videoId,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description: caption,
    }),
  });
  const finishData = await finishRes.json();
  if (!finishRes.ok || finishData.error || finishData.success === false) {
    console.error("đăng THẤT BẠI (finish):", JSON.stringify(finishData, null, 2));
    process.exit(1);
  }

  return { videoId };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
