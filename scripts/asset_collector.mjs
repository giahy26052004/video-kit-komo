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
 * --topic <query> (optional): tìm ảnh minh hoạ chủ đề (không gắn với 1 repo/
 * trang cụ thể) bằng cách chụp màn hình trang kết quả Bing Images cho query
 * đó -> topic-visual.png. Dùng để slide text/bullet (vốn trước giờ chỉ có
 * nền màu) cũng có ảnh minh hoạ thật, không cần API ảnh trả phí.
 *
 * Usage:
 *   node scripts/asset_collector.mjs --slug ai-agent \
 *     --repo https://github.com/obra/superpowers \
 *     --website https://example.com \
 *     --topic "ai agent"
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

/**
 * Tìm ảnh minh hoạ cho 1 chủ đề (không phải 1 URL cụ thể) bằng cách search
 * Bing Images rồi chụp lại lưới kết quả — vẫn là "chụp màn hình thật" đúng
 * tinh thần cả file này (không hotlink ảnh của người khác, không dùng API
 * ảnh trả phí), chỉ khác nguồn là trang search thay vì 1 site cố định.
 */
async function screenshotTopicVisual(page, query, destPath) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
  await page.goto(url, { waitUntil: "load", timeout: 25000 });
  // Đóng banner cookie/consent nếu có — không fatal nếu không tìm thấy nút.
  for (const sel of ["#bnp_btn_accept", "button#onetrust-accept-btn-handler"]) {
    await page.click(sel, { timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(1500); // để lưới ảnh kịp lazy-load
  await page.screenshot({ path: destPath, fullPage: false });
}

async function main() {
  const slug = arg("slug");
  const repoUrl = arg("repo");
  const websiteUrl = arg("website");
  const releasesUrl = arg("releases");
  const hnUrl = arg("hn");
  const topic = arg("topic");
  if (!slug) {
    console.error("usage: asset_collector.mjs --slug <slug> [--repo <url>] [--website <url>] [--releases <url>] [--hn <url>] [--topic <query>]");
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

  if (topic) {
    try {
      const dest = path.join(workspace, "topic-visual.png");
      await screenshotTopicVisual(page, topic, dest);
      manifest.captured.push({ name: "topic-visual.png", source: `bing-images:${topic}`, kind: "topic-visual" });
      console.log(`  topic-visual.png <- bing images "${topic}"`);
    } catch (e) {
      console.warn(`  topic-visual.png screenshot FAILED ("${topic}"): ${e.message}`);
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
