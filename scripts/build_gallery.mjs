#!/usr/bin/env node
/**
 * build_gallery.mjs — Quét từng project trong out/, tìm file out/full.mp4 bên
 * trong, tạo 1 trang HTML xem tổng quan tất cả video đã render (title, thời
 * lượng, trạng thái). Mở trực tiếp bằng trình duyệt (file://), không cần server.
 *
 * Usage: node scripts/build_gallery.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = path.join(KIT_ROOT, "out");

function ffprobeDuration(file) {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`,
      { encoding: "utf8" }
    );
    return parseFloat(out.trim());
  } catch {
    return null;
  }
}

function fmtDuration(sec) {
  if (sec == null) return "?";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function main() {
  const projects = fs.readdirSync(OUT_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const cards = [];
  for (const name of projects) {
    const projDir = path.join(OUT_ROOT, name);
    const mp4 = path.join(projDir, "out", "full.mp4");
    const scriptPath = path.join(projDir, "script.json");
    if (!fs.existsSync(mp4)) continue; // chưa render xong -> bỏ qua

    let title = name;
    try {
      const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
      title = script.title || name;
    } catch { /* giữ tên project làm title */ }

    const stat = fs.statSync(mp4);
    const duration = ffprobeDuration(mp4);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    const mtime = stat.mtime.toLocaleString("vi-VN");
    // File path tuyệt đối, dùng file:// để trình duyệt load được video local.
    const fileUrl = "file:///" + mp4.replace(/\\/g, "/");

    cards.push(`
      <div class="card">
        <video controls preload="metadata" src="${esc(fileUrl)}"></video>
        <div class="meta">
          <h3>${esc(title)}</h3>
          <p class="sub">${esc(name)} · ${fmtDuration(duration)} · ${sizeMB} MB</p>
          <p class="time">Render lúc: ${esc(mtime)}</p>
        </div>
      </div>`);
  }

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Video Gallery — claude-video-kit</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0b0f; color:#e5e7eb; font-family: -apple-system, 'Segoe UI', sans-serif; }
  header { padding: 24px 32px; border-bottom: 1px solid #1f2430; }
  header h1 { margin:0; font-size:20px; }
  header p { margin:6px 0 0; color:#9ca3af; font-size:13px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:20px; padding:24px 32px; }
  .card { background:#12141c; border:1px solid #1f2430; border-radius:12px; overflow:hidden; }
  .card video { width:100%; aspect-ratio: 9/16; background:#000; display:block; }
  .meta { padding:12px 14px; }
  .meta h3 { margin:0 0 4px; font-size:15px; line-height:1.3; }
  .sub { margin:0; font-size:12px; color:#22d3ee; }
  .time { margin:4px 0 0; font-size:11px; color:#6b7280; }
  .empty { padding: 60px 32px; text-align:center; color:#6b7280; }
</style>
</head>
<body>
  <header>
    <h1>🎬 Video Gallery</h1>
    <p>${projects.length ? cards.length : 0} video đã render · Tạo lúc ${new Date().toLocaleString("vi-VN")} · Chạy lại <code>node scripts/build_gallery.mjs</code> để cập nhật</p>
  </header>
  <div class="grid">
    ${cards.length ? cards.join("\n") : '<div class="empty">Chưa có video nào render xong.</div>'}
  </div>
</body>
</html>`;

  const outPath = path.join(OUT_ROOT, "gallery.html");
  fs.writeFileSync(outPath, html);
  console.log(`-> ${outPath} (${cards.length} video)`);
}

main();
