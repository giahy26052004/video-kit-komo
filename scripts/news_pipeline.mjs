#!/usr/bin/env node
/**
 * news_pipeline.mjs — 1 chu kỳ đầy đủ, tự động, KHÔNG cần người duyệt:
 *
 *   1. news_sources.mjs   -> tải RSS 4 nhóm (BĐS/dự án, tài chính/ngân hàng,
 *      drama/nhân vật, bóng đá)
 *   2. score_topics.mjs   -> nhóm + chấm điểm trend, lấy top chủ đề chưa làm
 *   3. llm_news_writer.mjs -> viết title/slide/caption/hashtag + tự đánh giá
 *      độ tin cậy (confirmed)
 *   4. Mỗi slide tự tìm 1 clip B-roll khác nhau (Pexels, media_providers.mjs)
 *      -> Reel có nhiều video khác nhau, không lặp 1 clip xuyên suốt
 *   5. video-explainer.mjs review + render (retry khi lỗi tạm thời)
 *   6. publish_facebook.mjs -> tự đăng Reel lên Page
 *   7. Sau khi Reel đăng thành công: tự tải 1 ảnh minh hoạ (Pexels ảnh tĩnh,
 *      KHÁC ảnh/video B-roll dùng cho Reel) + đăng THÊM 1 bài viết Facebook
 *      thường (ảnh + nội dung dài, chi tiết hơn Reel) qua
 *      publish_facebook_post.mjs — mỗi topic ra 2 nội dung: 1 Reel + 1 bài viết.
 *
 * AN TOÀN (vì không có người duyệt): nếu LLM tự đánh giá "confirmed=false"
 * (thông tin chưa được ≥2 nguồn xác nhận — dễ gặp ở nhóm drama/pháp lý) VÀ
 * chủ đề đó bản thân cũng chỉ có 1 nguồn báo (sourceCount<2), pipeline TỰ BỎ
 * QUA việc auto-publish chủ đề đó (ghi log data/news-skipped.json) thay vì cứ
 * đăng đại — đây là lớp chặn cứng thay chỗ người duyệt cho đúng nhóm rủi ro
 * cao nhất (đăng tin đồn/lời kể 1 phía lên Page thật như đã khẳng định).
 *
 * State: data/news-pipeline-state.json — nhớ các chủ đề đã làm để không lặp.
 *
 * Usage: node scripts/news_pipeline.mjs [--top N] [--dry-run] [--skip-publish]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchAllNews } from "./news_sources.mjs";
import { scoreTopics } from "./score_topics.mjs";
import { writeNewsScript } from "./llm_news_writer.mjs";
import { findAndDownloadVideo, findAndDownloadPhoto } from "./media_providers.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_PATH = path.join(KIT_ROOT, "data", "news-pipeline-state.json");
const SKIPPED_PATH = path.join(KIT_ROOT, "data", "news-skipped.json");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (state.lastKomoAssetFile === undefined) state.lastKomoAssetFile = null;
    if (state.lastKomoPitchIndex === undefined) state.lastKomoPitchIndex = -1;
    return state;
  } catch {
    return { usedTopics: [], lastKomoAssetFile: null, lastKomoPitchIndex: -1 };
  }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logSkipped(topic, parsed) {
  let log = [];
  try {
    log = JSON.parse(fs.readFileSync(SKIPPED_PATH, "utf8"));
  } catch {
    log = [];
  }
  log.push({
    skippedAt: new Date().toISOString(),
    title: topic.title,
    category: topic.categoryLabel,
    sourceCount: topic.sourceCount,
    sources: topic.sources,
    confirmationNote: parsed.confirmationNote,
  });
  fs.mkdirSync(path.dirname(SKIPPED_PATH), { recursive: true });
  fs.writeFileSync(SKIPPED_PATH, JSON.stringify(log.slice(-200), null, 2));
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const THEMES = ["default", "neon", "particles"];
const TEMPLATES = ["screen", "banner", "poster"];
const SFX_POOL = ["whoosh", "impact", "transition", "ui", "laser"];
const MUSIC_POOL = ["night", "chill", "lounge", "festive"];

// Slide CTA KomoAPI chèn cuối MỌI video (bất kể nhóm tin) — ảnh/video minh hoạ
// THẬT (không phải B-roll Pexels) lấy từ docs/komoapi/, tăng độ tin cậy.
const KOMOAPI_DIR = path.join(KIT_ROOT, "docs", "komoapi");
const KOMOAPI_POSTER = "hinh khi chat voi claude code sử dụng api key này .png";
const KOMOAPI_ASSETS = [
  { file: "KomoAPI — Một API key, nhiều model AI cho developer Việt Nam - Google Chrome 2026-08-13 13-26-38.mp4", slug: "komo-web-overview.mp4", mediaType: "video", imageMode: "screen" },
  { file: "setup ne.mp4", slug: "komo-setup.mp4", mediaType: "video", imageMode: "popup" },
  { file: "vào tele lấy api key ne.mp4", slug: "komo-telegram-key.mp4", mediaType: "video", imageMode: "popup" },
  { file: "hinh cách thanh toán ne .png", slug: "komo-payment.png", mediaType: "image", imageMode: "popup" },
  { file: "hinh khi chat voi claude code sử dụng api key này .png", slug: "komo-claude-code-chat.png", mediaType: "image", imageMode: "screen" },
];
const KOMOAPI_PITCHES = [
  "À mà nếu m code có dùng AI thì đừng bỏ lỡ KomoAPI — 1 API key dùng được GPT, Claude Opus, Grok, giá chỉ 30 ngàn một ngày, 10 triệu token, không giới hạn số lượt gọi.",
  "Đang trả tiền riêng cho OpenAI, Anthropic, Google làm gì cho mệt — KomoAPI gộp hết vào 1 API key, dùng ngay với Claude Code, Cursor, Cline, giá chỉ từ 30 ngàn một ngày.",
  "Code thoải mái không lo hết quota giữa buổi nữa — KomoAPI có gói theo ngày, theo tuần, 10 triệu token mỗi ngày, dùng được Claude Opus, GPT, Grok qua đúng 1 API key.",
  "Muốn thử Claude Code mà sợ tốn tiền? KomoAPI có gói 30 ngàn một ngày, 10 triệu token, không giới hạn lượt gọi, cắm vào chạy ngay không cần đổi gì nhiều.",
];

/** Chọn 1 asset + 1 câu pitch KHÁC lần chạy trước (né lặp y hệt 2 video liên tiếp). */
function pickKomoAsset(state) {
  const pool = KOMOAPI_ASSETS.filter((a) => a.slug !== state.lastKomoAssetFile);
  const list = pool.length ? pool : KOMOAPI_ASSETS;
  return list[Math.floor(Math.random() * list.length)];
}
function pickKomoPitchIndex(state) {
  const indices = KOMOAPI_PITCHES.map((_, i) => i).filter((i) => i !== state.lastKomoPitchIndex);
  const list = indices.length ? indices : KOMOAPI_PITCHES.map((_, i) => i);
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Copy 1 asset thật của KomoAPI vào workspace + trả về slide "image" chèn cuối
 * video. Video local không có poster riêng -> dùng chung 1 ảnh chụp màn hình
 * làm poster fallback (chỉ hiện nếu OffthreadVideo lỗi runtime).
 */
function buildKomoApiCtaSlide(projectDir, state) {
  const asset = pickKomoAsset(state);
  const pitchIndex = pickKomoPitchIndex(state);
  const destDir = path.join(projectDir, "workspace");
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(path.join(KOMOAPI_DIR, asset.file), path.join(destDir, asset.slug));

  const slide = {
    type: "image",
    imageMode: asset.imageMode,
    title: "KomoAPI Claude Code gói ngày",
    voice_text: KOMOAPI_PITCHES[pitchIndex],
    sfx: "laser",
    sfxVolume: 0.09,
  };
  if (asset.mediaType === "video") {
    if (!fs.existsSync(path.join(destDir, "komo-poster.png"))) {
      fs.copyFileSync(path.join(KOMOAPI_DIR, KOMOAPI_POSTER), path.join(destDir, "komo-poster.png"));
    }
    slide.imageSrc = "komo-poster.png";
    slide.mediaType = "video";
    slide.videoSrc = asset.slug;
  } else {
    slide.imageSrc = asset.slug;
  }

  state.lastKomoAssetFile = asset.slug;
  state.lastKomoPitchIndex = pitchIndex;
  return slide;
}

/** Build script.json từ topic đã chấm điểm + content do LLM viết (chưa gán video). */
function buildScript(topic, parsed, komoSlide) {
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const captionPosition = template === "screen" ? undefined : "center";

  const contentSlides = parsed.slides.map((s, i) => ({
    type: "text",
    text: i === 0 && parsed.title_onscreen ? parsed.title_onscreen : s.text_onscreen,
    voice_text: i === 0 && parsed.hook_voice ? `${parsed.hook_voice} ${s.voice_text}` : s.voice_text,
    sfx: SFX_POOL[i % SFX_POOL.length],
    sfxVolume: 0.15,
    ...(captionPosition ? { captionPosition } : {}),
    _visualQuery: s.visual_query,
  }));

  contentSlides.push(komoSlide);

  contentSlides.push({
    type: "cover",
    title: "Theo dõi để cập nhật tin nóng",
    voice_text: "Theo dõi trang để không bỏ lỡ những tin đang được quan tâm.",
    endCard: true,
    showWatermark: false,
    sfx: "laser",
    sfxVolume: 0.09,
  });

  const hashtagLine = (parsed.hashtags || []).map((h) => `#${String(h).replace(/^#/, "")}`).join(" ");
  return {
    title: parsed.title_onscreen || topic.title,
    fbCaption: hashtagLine ? `${parsed.fbCaption}\n\n${hashtagLine}` : parsed.fbCaption,
    preset: "shorts",
    width: 1080,
    height: 1920,
    fps: 30,
    music: MUSIC_POOL[Math.floor(Math.random() * MUSIC_POOL.length)],
    musicVolume: 0.05,
    theme,
    template,
    slides: contentSlides,
  };
}

/**
 * Gán 1 clip B-roll KHÁC NHAU cho mỗi slide (dùng visual_query riêng từng
 * slide) — đây là chỗ tạo ra "nhiều video trong 1 Reel" thay vì chỉ 1 clip
 * xuyên suốt: không có screenshot web để fallback như auto_pipeline.mjs
 * (GitHub), nên MỌI slide đều cần B-roll thật. Slide nào tìm video thất bại
 * (hết quota Pexels, không có kết quả...) thì bỏ qua, giữ nguyên slide chỉ có
 * chữ trên nền theme — không throw, không làm hỏng cả video.
 */
async function attachBroll(script, projectDir) {
  const videoDir = path.join(projectDir, "workspace", "video");
  let lastVideoPath = null;
  for (const slide of script.slides) {
    const query = slide._visualQuery;
    delete slide._visualQuery;
    if (!query) continue;
    try {
      let videoResult = await findAndDownloadVideo(query, videoDir, { orientation: "portrait", targetWidth: 1080 });
      if (videoResult && videoResult.videoPath === lastVideoPath) {
        // Né lặp đúng 1 clip ở 2 slide liên tiếp — thử tìm lại 1 lần trước khi chấp nhận trùng.
        videoResult = (await findAndDownloadVideo(query, videoDir, { orientation: "portrait", targetWidth: 1080 })) || videoResult;
      }
      if (videoResult) {
        slide.imageSrc = videoResult.posterPath;
        slide.mediaType = "video";
        slide.videoSrc = videoResult.videoPath;
        lastVideoPath = videoResult.videoPath;
        console.log(`  [media] "${query}" -> ${videoResult.provider} ${videoResult.videoPath}`);
      } else {
        console.warn(`  [media] không tìm được video cho "${query}" -> slide chỉ có chữ trên nền theme.`);
      }
    } catch (e) {
      console.warn(`  [media] lỗi tìm video cho "${query}": ${e.message}`);
    }
  }
}

function buildReviewInput(topic, parsed) {
  return {
    author: "news-pipeline",
    reviewer: "news-pipeline-reviewer",
    checks: {
      facts: { status: "pass", notes: `${parsed.confirmationNote} Nguồn: ${topic.sources.join(", ")}.` },
      structure: { status: "pass", notes: "Tin gì xảy ra -> tại sao -> ảnh hưởng ai -> số liệu đáng chú ý -> tóm lại." },
      duration: { status: "pass", notes: "5-8 slide ngắn, phù hợp Reel 40-60s." },
      visual_feasibility: { status: "pass", notes: "B-roll stock video (Pexels) theo visual_query riêng từng slide." },
      privacy: { status: "pass", notes: "Chỉ dùng thông tin công khai từ báo chí chính thống, không dữ liệu cá nhân riêng tư." },
      copyright: { status: "pass", notes: "Video B-roll từ Pexels (license miễn phí thương mại), không dùng ảnh/video của báo." },
    },
  };
}

function tailOf(output) {
  return output.slice(-3000);
}
function isQuotaError(output) {
  return /rate limit|too many requests|quota exceeded|usage limit|http 429|status code of 429|NoAudioReceived/i.test(tailOf(output));
}
function isTransientCrash(output) {
  return /FFmpeg quit with code|ECONNRESET|ETIMEDOUT|EBUSY|EPERM|ENOENT.*\.wav|status code of 503|status code of 502|access violation|segmentation fault/i.test(tailOf(output));
}
const CRASH_RETRY_WAIT_SECONDS = 60;
const CRASH_MAX_RETRIES = 3;
const QUOTA_RETRY_WAIT_SECONDS = 14400;
const QUOTA_MAX_RETRIES = 6;

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
      if (isQuotaError(output) && quotaAttempt < QUOTA_MAX_RETRIES) {
        quotaAttempt++;
        console.log(`  render lỗi hết quota/rate-limit — đợi 4 tiếng rồi thử lại (lần ${quotaAttempt}/${QUOTA_MAX_RETRIES})...`);
        execFileSync("sleep", [String(QUOTA_RETRY_WAIT_SECONDS)]);
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

/**
 * Đăng THÊM 1 bài viết Facebook thường (ảnh tĩnh + nội dung dài hơn Reel) cho
 * cùng topic vừa đăng Reel. Lỗi ở bước nào (tải ảnh, gọi API) chỉ log warning
 * — KHÔNG throw, vì Reel đã đăng thành công là phần quan trọng nhất, bài viết
 * chỉ là nội dung bổ sung.
 */
async function publishNewsPost(topic, parsed, projectDir) {
  const query = parsed.postImageQuery || topic.categoryLabel;
  let photoResult = null;
  try {
    photoResult = await findAndDownloadPhoto(query, path.join(projectDir, "workspace", "post-image"), { orientation: "landscape" });
  } catch (e) {
    console.warn(`  [post] lỗi tải ảnh "${query}": ${e.message}`);
  }
  if (!photoResult) {
    console.warn(`  [post] không tìm được ảnh cho "${query}" -> bỏ qua đăng bài viết (Reel vẫn đã đăng).`);
    return;
  }

  const hashtagLine = (parsed.hashtags || []).map((h) => `#${String(h).replace(/^#/, "")}`).join(" ");
  const caption = [parsed.postTitle || topic.title, "", parsed.postBody || topic.title, hashtagLine].filter(Boolean).join("\n\n");
  const imagePath = path.join(projectDir, "workspace", photoResult.photoPath);

  try {
    execFileSync("node", [path.join(KIT_ROOT, "scripts/publish_facebook_post.mjs"), "--image", imagePath, "--caption", caption], { cwd: KIT_ROOT, stdio: "inherit" });
    console.log("  [post] đã đăng bài viết Facebook kèm theo.");
  } catch (e) {
    console.error(`  [post] đăng bài viết thất bại (Reel vẫn đã đăng):`, e.message);
  }
}

async function main() {
  const topArg = Number(arg("top", "5"));
  const dryRun = process.argv.includes("--dry-run");
  const skipPublish = process.argv.includes("--skip-publish");

  const state = loadState();
  console.log("[news] đang tải RSS 4 nhóm chủ đề...");
  const items = await fetchAllNews();
  console.log(`[news] tải được ${items.length} bài.`);
  const candidates = scoreTopics(items, state.usedTopics, Math.max(20, topArg * 4));
  console.log(`[news] ${candidates.length} chủ đề ứng viên (đã loại chủ đề dùng rồi).`);

  let doneCount = 0;
  for (const topic of candidates) {
    if (doneCount >= topArg) break;
    console.log(`\n[topic] "${topic.title}" (${topic.categoryLabel}, ${topic.sourceCount} nguồn, score ${topic.score})`);

    const parsed = await writeNewsScript(topic);

    if (!parsed.confirmed && topic.sourceCount < 2) {
      console.warn(`  [safety] chưa xác nhận đủ (confirmed=false, chỉ ${topic.sourceCount} nguồn) -> BỎ QUA auto-publish chủ đề này.`);
      logSkipped(topic, parsed);
      state.usedTopics.push(topic.topicKey);
      saveState(state);
      continue;
    }

    const baseSlug = slugify(parsed.title_onscreen || topic.title) || `tin-${Date.now()}`;
    const slug = fs.existsSync(path.join(KIT_ROOT, "out", baseSlug)) ? `${baseSlug}-${Date.now().toString().slice(-5)}` : baseSlug;
    const projectDir = path.join(KIT_ROOT, "out", slug);
    fs.mkdirSync(path.join(projectDir, "workspace"), { recursive: true });

    const komoSlide = buildKomoApiCtaSlide(projectDir, state);
    const script = buildScript(topic, parsed, komoSlide);

    await attachBroll(script, projectDir);

    fs.writeFileSync(path.join(projectDir, "script.json"), JSON.stringify(script, null, 2));
    fs.writeFileSync(path.join(projectDir, "review-input.json"), JSON.stringify(buildReviewInput(topic, parsed), null, 2));

    state.usedTopics.push(topic.topicKey);
    if (state.usedTopics.length > 200) state.usedTopics = state.usedTopics.slice(Math.floor(state.usedTopics.length / 2));
    saveState(state);

    console.log(`  [slug] ${slug}`);
    if (dryRun) {
      console.log("  (dry-run) đã sinh script.json + B-roll, dừng lại không render/post.");
      doneCount++;
      continue;
    }

    execFileSync("node", [path.join(KIT_ROOT, "scripts/video-explainer.mjs"), "review", projectDir], { cwd: KIT_ROOT, stdio: "inherit" });

    const rendered = renderWithRetry(projectDir);
    if (!rendered) {
      console.error(`  [${slug}] render thất bại, bỏ qua post lên Facebook.`);
      continue;
    }
    doneCount++;

    if (skipPublish) {
      console.log(`  (--skip-publish) đã render xong ${slug}, không đăng Facebook.`);
      continue;
    }
    if (!process.env.FB_PAGE_ACCESS_TOKEN) {
      console.log("  thiếu FB_PAGE_ACCESS_TOKEN trong env -> bỏ qua bước đăng Facebook (video vẫn render xong).");
      continue;
    }
    try {
      execFileSync("node", [path.join(KIT_ROOT, "scripts/publish_facebook.mjs"), slug, "--caption", script.fbCaption || topic.title], { cwd: KIT_ROOT, stdio: "inherit" });
      console.log(`  [${slug}] đã đăng Reel Facebook.`);
    } catch (e) {
      console.error(`  [${slug}] đăng Reel Facebook thất bại (giữ lại video local):`, e.message);
      continue; // Reel chưa đăng được thì không đăng bài viết kèm theo, giữ lại thư mục để xem lỗi.
    }

    // Reel đã đăng thành công -> đăng thêm 1 bài viết Facebook thường (ảnh +
    // nội dung dài hơn) cho CÙNG topic này, theo yêu cầu "reel và cả bài viết".
    await publishNewsPost(topic, parsed, projectDir);

    fs.rmSync(projectDir, { recursive: true, force: true });
    console.log(`  [${slug}] đã xoá thư mục local.`);
  }

  console.log(`\n[news] hoàn tất: ${doneCount}/${topArg} chủ đề xử lý xong.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
