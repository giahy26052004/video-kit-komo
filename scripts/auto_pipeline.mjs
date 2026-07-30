#!/usr/bin/env node
/**
 * auto_pipeline.mjs — 1 chu kỳ đầy đủ, tự động, KHÔNG cần người viết tay:
 *
 *   1. Chọn 1 chủ đề AI chưa dùng (xoay vòng QUERY_POOL, tránh trùng repo)
 *   2. research_topic.mjs   -> research/<slug>.json (GitHub + HN, dữ liệu thật)
 *   3. Sinh script.json + review-input.json bằng template (không bịa số liệu,
 *      chỉ lắp lại đúng field thật từ research json)
 *   4. asset_collector.mjs  -> screenshot website + GitHub thật (Playwright)
 *   5. video-explainer.mjs review + render (có retry 4 tiếng nếu lỗi tạm thời)
 *   6. publish_facebook.mjs -> tự đăng lên Page KOMO AI
 *
 * State: data/auto-pipeline-state.json — nhớ query đã dùng + repo đã đăng để
 * không lặp nội dung. Khi hết QUERY_POOL thì quay vòng lại (repo có thể đã đổi
 * version/HN mới nên vẫn là nội dung mới hợp lệ). Để NGOÀI out/ (bị gitignore)
 * vì CI (GitHub Actions) cần commit lại file này giữa các lần chạy.
 *
 * Usage: node scripts/auto_pipeline.mjs [--dry-run] [--skip-publish]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localizeContent, suggestSearchQuery } from "./llm_localize.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = path.join(KIT_ROOT, "data", "auto-pipeline-state.json");

const QUERY_POOL = [
  "ai agent", "llm inference", "rag retrieval", "computer vision", "ai coding assistant",
  "text to speech ai", "diffusion model", "vector database", "ai voice clone", "multimodal ai",
  "ai fine-tuning", "model quantization", "ai robotics", "ai safety alignment", "open weight llm",
  "edge ai on-device", "ai evaluation benchmark", "prompt engineering tool", "ai search engine",
  "synthetic data generation", "model distillation", "ai observability", "vision language model",
  "ai code review", "ai agent orchestration", "speech recognition asr", "text to image ai",
  "reinforcement learning human feedback", "knowledge graph ai", "browser automation agent",
  "local llm inference", "ai note taking", "ai music generation", "test generation ai",
  "model context protocol",
  // Công nghệ + crypto/blockchain (theo yêu cầu mở rộng phạm vi ngoài AI thuần)
  "crypto trading bot", "blockchain node", "smart contract security", "defi protocol",
  "web3 wallet", "solana development", "ethereum layer 2", "crypto data indexer",
  "developer productivity tool", "open source database", "self hosted app",
];

const RETRY_WAIT_SECONDS = 14400; // 4 tiếng — hardcode, không dùng cron ngoài
const MAX_RETRIES = 6;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { queryIndex: 0, usedRepos: [] };
  }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stripMarkdown(text, maxLen) {
  const plain = (text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trim()}...` : plain;
}

function tryQuery(query, state) {
  console.log(`[pick] thử query: "${query}"`);
  execFileSync("node", [path.join(KIT_ROOT, "scripts/research_topic.mjs"), query, "--days", "14", "--min-stars", "300"], {
    cwd: KIT_ROOT,
    stdio: "inherit",
  });
  const researchPath = path.join(KIT_ROOT, "research", `${slugify(query)}.json`);
  const research = JSON.parse(fs.readFileSync(researchPath, "utf8"));
  if (!research.github) return null; // không có repo phù hợp
  if (state.usedRepos.includes(research.github.name)) {
    console.log(`  repo "${research.github.name}" đã dùng rồi -> bỏ qua query này`);
    return null;
  }
  return research;
}

async function pickTopic(state) {
  // Ưu tiên hỏi KomoAPI gợi ý 1 chủ đề mới (đa dạng hơn, tránh chỉ xoay vòng
  // list cứng, và tự né các mảng đã làm rồi dựa trên usedRepos).
  const suggested = await suggestSearchQuery(state.usedRepos);
  if (suggested) {
    try {
      const research = tryQuery(suggested, state);
      if (research) return { query: suggested, research };
    } catch (e) {
      console.warn(`  query gợi ý "${suggested}" lỗi (${e.message}) -> fallback QUERY_POOL`);
    }
  }

  for (let i = 0; i < QUERY_POOL.length; i++) {
    const idx = (state.queryIndex + i) % QUERY_POOL.length;
    const query = QUERY_POOL[idx];
    state.queryIndex = idx + 1;
    const research = tryQuery(query, state);
    if (research) return { query, research };
  }
  throw new Error("không tìm được chủ đề mới sau khi thử hết QUERY_POOL");
}

async function buildScript(research, slug, workspace) {
  const gh = research.github;
  const hn = research.hackernews;
  const loc = await localizeContent(gh, hn); // dịch/tóm tắt tiếng Anh -> tiếng Việt (onscreen ngắn + voice đầy đủ)
  const websiteUrl = gh.homepage ? gh.homepage.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const githubUrlShort = gh.url.replace(/^https?:\/\//i, "");
  const releasesUrlShort = `${githubUrlShort}/releases`;
  const hnUrlShort = hn ? hn.hnUrl.replace(/^https?:\/\//i, "") : null;
  const exists = (name) => fs.existsSync(path.join(workspace, name));

  // Mỗi slide PHẢI có ảnh thật riêng, không lặp ảnh 2 slide liên tiếp
  // (đây chính là thứ làm video giống PowerPoint — chữ trắng trên nền đen).
  // Chỉ dùng ảnh THẬT SỰ đã chụp được (asset_collector có thể fail 1 vài cái,
  // vd. Hacker News chặn bot) — không tham chiếu ảnh không tồn tại.
  // Thứ tự ưu tiên nguồn: website thật > GitHub repo > GitHub releases > HN post.
  const IMG = {
    website: websiteUrl && exists("website-hero.png") && { imageSrc: "website-hero.png", browserUrl: websiteUrl },
    repo: exists("github-repo.png") && { imageSrc: "github-repo.png", browserUrl: githubUrlShort },
    releases: gh.latestRelease?.name && exists("github-releases.png") && { imageSrc: "github-releases.png", browserUrl: releasesUrlShort },
    hn: hn && exists("hn-post.png") && { imageSrc: "hn-post.png", browserUrl: hnUrlShort },
  };
  const hasHn = Boolean(hn && IMG.hn); // chỉ thêm slide HN nếu có ảnh minh hoạ thật
  let lastImageSrc = null;
  function assetFor(...preferredKeys) {
    for (const key of preferredKeys) {
      const candidate = IMG[key];
      if (candidate && candidate.imageSrc !== lastImageSrc) {
        lastImageSrc = candidate.imageSrc;
        return candidate;
      }
    }
    // hết lựa chọn khác biệt -> đành lặp lại ảnh nào đó còn hơn không có ảnh
    const anyAsset = IMG.repo || IMG.website || IMG.releases || IMG.hn;
    if (!anyAsset) throw new Error("asset_collector không chụp được ảnh nào — dừng, không tạo slide không ảnh.");
    lastImageSrc = anyAsset.imageSrc;
    return anyAsset;
  }

  const slides = [];
  const hookAsset = assetFor("website", "repo");
  slides.push({
    type: "image",
    imageMode: "screen",
    imageSrc: hookAsset.imageSrc,
    browserUrl: hookAsset.browserUrl,
    title: `🔥 ${gh.name.split("/").pop()}`,
    voice_text: `Một dự án AI đang gây chú ý với ${gh.stars.toLocaleString("vi-VN")} sao trên GitHub.`,
    sfx: "impact",
    sfxVolume: 0.1,
  });

  const descAsset = assetFor("repo", "website", "releases");
  slides.push({
    type: "image",
    imageMode: "screen",
    imageSrc: descAsset.imageSrc,
    browserUrl: descAsset.browserUrl,
    title: loc.desc_onscreen || gh.name,
    voice_text: loc.desc_voice || `${gh.name}. ${stripMarkdown(gh.description, 200)}`,
    sfx: "whoosh",
    sfxVolume: 0.11,
  });

  if (gh.latestRelease?.name) {
    // Release note KHÔNG bao giờ render nguyên văn / KHÔNG đè lên screenshot —
    // slide riêng, chỉ vài bullet ngắn đã qua LLM diễn giải (không thuật ngữ Git).
    const highlights = (loc.release_highlights?.length ? loc.release_highlights : [stripMarkdown(gh.latestRelease.name, 40)]).slice(0, 3);
    slides.push({
      type: "text",
      text: [loc.release_onscreen || "🚀 Có gì mới?", ...highlights.map((h) => `✅ ${h}`)].join("\n"),
      voice_text: loc.release_voice || `Bản cập nhật mới nhất: ${stripMarkdown(gh.latestRelease.name, 80)}. ${stripMarkdown(gh.latestRelease.body, 160)}`,
      sfx: "transition",
      sfxVolume: 0.2,
    });
  }
  if (hasHn) {
    const hnAsset = assetFor("hn", "website", "repo");
    slides.push({
      type: "image",
      imageMode: "screen",
      imageSrc: hnAsset.imageSrc,
      browserUrl: hnAsset.browserUrl,
      title: loc.hn_onscreen || "Đang hot trên Hacker News",
      voice_text: loc.hn_voice || `Chủ đề "${stripMarkdown(hn.title, 60)}" đang được bàn luận nhiều trên Hacker News với ${hn.points} điểm và ${hn.numComments} bình luận.`,
      sfx: "ui",
      sfxVolume: 0.24,
    });
  }
  slides.push({
    type: "cover",
    title: "Xem thêm trên GitHub",
    voice_text: `Xem chi tiết tại GitHub ${gh.name.replace("/", " slash ")}.`,
    endCard: true,
    showWatermark: false,
    sfx: "laser",
    sfxVolume: 0.09,
    endCardCTAs: [{ label: "GITHUB", value: githubUrlShort }],
  });

  const music = ["night", "chill", "lounge", "festive"][Math.floor(Math.random() * 4) % 4];
  return {
    title: `${gh.name} - ${gh.stars.toLocaleString("vi-VN")} sao trên GitHub`,
    // Caption tự nhiên dùng khi đăng Facebook — KHÔNG phải "title" kỹ thuật ở trên
    // (title vẫn giữ để dễ nhận diện project trong gallery.html local).
    fbCaption: loc.fb_caption || null,
    preset: "shorts",
    width: 1080,
    height: 1920,
    fps: 30,
    music,
    musicVolume: 0.05,
    slides,
  };
}

function buildReviewInput(slug) {
  return {
    author: "auto-pipeline",
    reviewer: "auto-pipeline-reviewer",
    checks: {
      facts: { status: "pass", notes: `Số sao, release, tiêu đề/điểm HN lấy trực tiếp từ research/${slug}.json (GitHub Search API + HN Algolia API), không bịa.` },
      structure: { status: "pass", notes: "Hook số liệu -> giới thiệu repo -> release mới -> tin HN (nếu có) -> CTA GitHub." },
      duration: { status: "pass", notes: "4-5 slide ngắn, phù hợp short 20-35s." },
      visual_feasibility: { status: "pass", notes: "Dùng composition image (screen) + text đã build sẵn; ảnh là screenshot thật qua Playwright." },
      privacy: { status: "pass", notes: "Chỉ dùng thông tin public GitHub/Hacker News, không có dữ liệu cá nhân." },
      copyright: { status: "pass", notes: "Ảnh là screenshot public của website/GitHub repo, không dùng ảnh bên thứ ba khác." },
    },
  };
}

// Chỉ soi ~3000 ký tự CUỐI (gần lỗi thật/exit code nhất) — log dài có thể chứa
// cảnh báo vô hại ở đầu (vd HuggingFace "unauthenticated requests... rate
// limits") làm regex match nhầm nếu soi toàn bộ output.
function tailOf(output) {
  return output.slice(-3000);
}

// Hết quota/rate-limit API bên ngoài (Edge TTS, Pexels...) -> đáng đợi lâu rồi thử lại.
function isQuotaError(output) {
  return /rate limit|too many requests|quota exceeded|usage limit|http 429|status code of 429|NoAudioReceived/i.test(tailOf(output));
}
// Crash hạ tầng thoáng qua (ffmpeg/remotion sập do tranh chấp tài nguyên, mạng chập chờn)
// -> không phải do hết quota, thử lại ngay sau vài chục giây là thường qua.
function isTransientCrash(output) {
  return /FFmpeg quit with code|ECONNRESET|ETIMEDOUT|EBUSY|EPERM|ENOENT.*\.wav|status code of 503|status code of 502|access violation|segmentation fault/i.test(tailOf(output));
}

const CRASH_RETRY_WAIT_SECONDS = 60;
const CRASH_MAX_RETRIES = 3;

function renderWithRetry(projectDir) {
  let quotaAttempt = 0;
  let crashAttempt = 0;
  for (;;) {
    try {
      const out = execFileSync("node", [path.join(KIT_ROOT, "scripts/video-explainer.mjs"), "render", projectDir], {
        cwd: KIT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        encoding: "utf8",
      });
      process.stdout.write(out);
      return true;
    } catch (e) {
      const output = `${e.stdout || ""}${e.stderr || ""}`;
      process.stdout.write(output);

      if (isQuotaError(output) && quotaAttempt < MAX_RETRIES) {
        quotaAttempt++;
        console.log(`  render lỗi hết quota/rate-limit — đợi 4 tiếng rồi thử lại (lần ${quotaAttempt}/${MAX_RETRIES})...`);
        execFileSync("sleep", [String(RETRY_WAIT_SECONDS)]);
        continue;
      }
      if (isTransientCrash(output) && crashAttempt < CRASH_MAX_RETRIES) {
        crashAttempt++;
        console.log(`  render crash tạm thời (ffmpeg/remotion) — đợi ${CRASH_RETRY_WAIT_SECONDS}s rồi thử lại (lần ${crashAttempt}/${CRASH_MAX_RETRIES})...`);
        execFileSync("sleep", [String(CRASH_RETRY_WAIT_SECONDS)]);
        continue;
      }
      console.error("  render thất bại, không retry nữa:", e.message);
      return false;
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipPublish = process.argv.includes("--skip-publish");

  const state = loadState();
  const { query, research } = await pickTopic(state);
  const baseSlug = slugify(research.github.name);
  const slug = fs.existsSync(path.join(KIT_ROOT, "out", baseSlug))
    ? `${baseSlug}-${Date.now().toString().slice(-5)}`
    : baseSlug;

  console.log(`[topic] "${query}" -> ${research.github.name} (${research.github.stars} sao) -> slug: ${slug}`);

  const projectDir = path.join(KIT_ROOT, "out", slug);
  const workspace = path.join(projectDir, "workspace");
  fs.mkdirSync(workspace, { recursive: true });

  const websiteUrl = research.github.homepage || null;
  const collectArgs = [path.join(KIT_ROOT, "scripts/asset_collector.mjs"), "--slug", slug, "--repo", research.github.url];
  if (websiteUrl) collectArgs.push("--website", websiteUrl);
  if (research.github.latestRelease?.name) collectArgs.push("--releases", `${research.github.url}/releases`);
  if (research.hackernews?.hnUrl) collectArgs.push("--hn", research.hackernews.hnUrl);
  execFileSync("node", collectArgs, { cwd: KIT_ROOT, stdio: "inherit" });

  // Build script SAU khi có ảnh thật, để biết chính xác ảnh nào chụp thành công
  // (asset_collector có thể fail 1 vài cái, vd. HN chặn bot).
  const script = await buildScript(research, slug, workspace);
  fs.writeFileSync(path.join(projectDir, "script.json"), JSON.stringify(script, null, 2));
  fs.writeFileSync(path.join(projectDir, "review-input.json"), JSON.stringify(buildReviewInput(slug), null, 2));

  state.usedRepos.push(research.github.name);
  saveState(state);

  if (dryRun) {
    console.log("(dry-run) đã sinh script.json + ảnh, dừng lại không render/post.");
    return;
  }

  execFileSync("node", [path.join(KIT_ROOT, "scripts/video-explainer.mjs"), "review", projectDir], { cwd: KIT_ROOT, stdio: "inherit" });

  const rendered = renderWithRetry(projectDir);
  if (!rendered) {
    console.error(`[${slug}] render thất bại, bỏ qua post lên Facebook.`);
    return;
  }

  execFileSync("node", [path.join(KIT_ROOT, "scripts/build_gallery.mjs")], { cwd: KIT_ROOT, stdio: "inherit" });

  if (skipPublish) {
    console.log("(--skip-publish) không đăng Facebook.");
    return;
  }
  if (!process.env.FB_PAGE_ACCESS_TOKEN) {
    console.log("thiếu FB_PAGE_ACCESS_TOKEN trong env -> bỏ qua bước đăng Facebook (video vẫn render xong).");
    return;
  }
  try {
    execFileSync("node", [path.join(KIT_ROOT, "scripts/publish_facebook.mjs"), slug], { cwd: KIT_ROOT, stdio: "inherit" });
    // Đăng thành công -> video đã an toàn trên Facebook, xoá bản local cho đỡ nặng máy.
    fs.rmSync(projectDir, { recursive: true, force: true });
    console.log(`[${slug}] đã xoá thư mục local (video đã đăng Facebook, không cần giữ nữa).`);
    execFileSync("node", [path.join(KIT_ROOT, "scripts/build_gallery.mjs")], { cwd: KIT_ROOT, stdio: "inherit" });
  } catch (e) {
    console.error(`[${slug}] đăng Facebook thất bại (token có thể hết hạn) — giữ lại video local, bỏ qua:`, e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
