#!/usr/bin/env node
/**
 * asset_collector.mjs — Chụp ảnh THẬT từ web (Playwright) để làm hình cho
 * video, thay vì đoán ảnh stock. Thứ tự ưu tiên:
 *
 *   1. Website chính thức (homepage)  -> screenshot hero (viewport, không full page)
 *   2. Trang GitHub repo              -> screenshot phần header (sao, mô tả)
 *   3. Pexels (fallback cuối cùng)    -> chỉ dùng khi cả 2 trên đều fail
 *
 * Input: JSON qua stdin hoặc arg --config <file>, dạng:
 *   { "slug": "ai-agent", "repoUrl": "https://github.com/obra/superpowers",
 *     "websiteUrl": "https://example.com" (optional) }
 *
 * Output: workspace/<name>.png trong out/<slug>/workspace/, trả về manifest
 * JSON liệt kê ảnh đã chụp + nguồn thật (url) để ghi vào review-input.json.
 *
 * Usage:
 *   node scripts/asset_collector.mjs --slug ai-agent \
 *     --repo https://github.com/obra/superpowers \
 *     --website https://example.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIEWPORT = { width: 1280, height: 800 };
// Một số site (Hacker News...) chặn thẳng khi thấy UA "HeadlessChrome" mặc định
// của Playwright -> giả UA trình duyệt thật để chụp được.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function screenshotUrl(page, url, destPath, { fullPage = false, waitMs = 1200, waitUntil = "networkidle" } = {}) {
  try {
    await page.goto(url, { waitUntil, timeout: 25000 });
  } catch (e) {
    // Một số site (vd. github.com) không bao giờ "networkidle" vì có
    // polling/websocket nền — vẫn chụp được miễn DOM đã load xong.
    if (!/Timeout/.test(e.message)) throw e;
  }
  await page.waitForTimeout(waitMs); // để animation/lazy-load web kịp render

  // Hacker News (và vài site khác) chặn bot bằng trang chắn ngắn gọn kiểu
  // "Sorry." thay vì trả lỗi HTTP -> phải soi nội dung mới biết là bị chặn.
  const bodyText = (await page.textContent("body").catch(() => "")) || "";
  const trimmed = bodyText.trim();
  if (trimmed.length > 0 && trimmed.length < 40 && /^sorry\.?$/i.test(trimmed)) {
    throw new Error(`bị chặn bot (trang trả về: "${trimmed}")`);
  }

  await page.screenshot({ path: destPath, fullPage });
}

async function main() {
  const slug = arg("slug");
  const repoUrl = arg("repo");
  const websiteUrl = arg("website");
  const releasesUrl = arg("releases");
  const hnUrl = arg("hn");
  if (!slug) {
    console.error("usage: asset_collector.mjs --slug <slug> [--repo <url>] [--website <url>] [--releases <url>] [--hn <url>]");
    process.exit(1);
  }

  const workspace = path.join(KIT_ROOT, "out", slug, "workspace");
  fs.mkdirSync(workspace, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, userAgent: USER_AGENT });
  const manifest = { slug, captured: [] };

  const targets = [
    { url: websiteUrl, name: "website-hero.png", kind: "website", opts: {} },
    { url: repoUrl, name: "github-repo.png", kind: "github", opts: { waitMs: 1000, waitUntil: "load" } },
    { url: releasesUrl, name: "github-releases.png", kind: "github-releases", opts: { waitMs: 1000, waitUntil: "load" } },
    { url: hnUrl, name: "hn-post.png", kind: "hackernews", opts: { waitMs: 1000, waitUntil: "load" } },
  ];

  for (const t of targets) {
    if (!t.url) continue;
    try {
      const dest = path.join(workspace, t.name);
      await screenshotUrl(page, t.url, dest, t.opts);
      manifest.captured.push({ name: t.name, source: t.url, kind: t.kind });
      console.log(`  ${t.name} <- ${t.url}`);
    } catch (e) {
      console.warn(`  ${t.name} screenshot FAILED (${t.url}): ${e.message}`);
    }
  }

  await browser.close();

  const manifestPath = path.join(KIT_ROOT, "out", slug, "assets-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`-> ${manifestPath} (${manifest.captured.length} ảnh thật)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
