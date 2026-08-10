#!/usr/bin/env node
/**
 * publish_facebook_post.mjs — Đăng 1 bài viết Facebook THƯỜNG (1 ảnh + chữ,
 * KHÁC với Reel video của publish_facebook.mjs) lên Page qua Graph API:
 *   POST /{page-id}/photos  (multipart: source=file ảnh, caption, access_token)
 *
 * Token KHÔNG lưu vào file/git — chỉ truyền qua env FB_PAGE_ACCESS_TOKEN.
 *
 * Usage:
 *   FB_PAGE_ACCESS_TOKEN=xxx node scripts/publish_facebook_post.mjs \
 *     --image <path/to/photo.jpg> --caption "..." \
 *     [--page-id 1238372036022307] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const GRAPH_VERSION = "v25.0";
const DEFAULT_PAGE_ID = "1238372036022307"; // KOMO AI

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const imagePath = arg("image");
  const caption = arg("caption", "");
  const pageId = arg("page-id", DEFAULT_PAGE_ID);
  const dryRun = process.argv.includes("--dry-run");

  if (!imagePath) {
    console.error("usage: publish_facebook_post.mjs --image <path> --caption <text> [--page-id <id>] [--dry-run]");
    process.exit(1);
  }
  const resolvedImagePath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedImagePath)) {
    console.error(`ảnh không tồn tại: ${resolvedImagePath}`);
    process.exit(1);
  }

  console.log(`page: ${pageId}`);
  console.log(`ảnh: ${resolvedImagePath}`);
  console.log(`caption:\n${caption}\n`);

  if (dryRun) {
    console.log("(dry-run) không gọi API thật.");
    return;
  }

  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    console.error("thiếu FB_PAGE_ACCESS_TOKEN (env var) — không đăng.");
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(resolvedImagePath);
  const form = new FormData();
  form.append("source", new Blob([imageBuffer], { type: "image/jpeg" }), path.basename(resolvedImagePath));
  form.append("caption", caption);
  form.append("access_token", token);

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`;
  console.log(`đang đăng bài viết (ảnh ${(imageBuffer.length / 1024).toFixed(0)} KB) lên ${url} ...`);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error("đăng bài viết THẤT BẠI:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log("đăng bài viết thành công:", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
