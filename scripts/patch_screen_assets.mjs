#!/usr/bin/env node
/**
 * patch_screen_assets.mjs — Thay 2 slide ảnh đầu (cover.jpg/logo.png Pexels)
 * bằng screenshot THẬT (website-hero.png / github-repo.png) đã chụp qua
 * asset_collector.mjs. Giữ nguyên toàn bộ voice_text/nội dung đã viết.
 *
 * Usage: node scripts/patch_screen_assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PATCHES = {
  "llm-inference": { websiteUrl: "huggingface.co/transformers", githubUrl: "github.com/huggingface/transformers" },
  "rag-retrieval": { websiteUrl: "ragflow.io", githubUrl: "github.com/infiniflow/ragflow" },
  "computer-vision": { websiteUrl: "opencv.org", githubUrl: "github.com/opencv/opencv" },
  "ai-coding-assistant": { websiteUrl: "openspec.dev", githubUrl: "github.com/Fission-AI/OpenSpec" },
  "text-to-speech-ai": { websiteUrl: "docs.nvidia.com/nemo/speech", githubUrl: "github.com/NVIDIA-NeMo/Speech" },
  "vector-database": { websiteUrl: "redis.io", githubUrl: "github.com/redis/redis" },
  "ai-voice-clone": { websiteUrl: "voicebox.sh", githubUrl: "github.com/jamiepine/voicebox" },
  "multimodal-ai": { websiteUrl: "haystack.deepset.ai", githubUrl: "github.com/deepset-ai/haystack" },
};

for (const [slug, { websiteUrl, githubUrl }] of Object.entries(PATCHES)) {
  const scriptPath = path.join(KIT_ROOT, "out", slug, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));

  // slide 0: cover background -> screenshot website thật
  script.slides[0] = {
    ...script.slides[0],
    imageMode: "screen",
    imageSrc: "website-hero.png",
    browserUrl: websiteUrl,
  };
  delete script.slides[0].title; // "screen" mode đã có title riêng ở dưới ảnh nếu cần, tránh trùng

  // slide 1: popup logo -> screenshot GitHub repo thật (đúng số sao hiển thị trên ảnh)
  script.slides[1] = {
    ...script.slides[1],
    imageMode: "screen",
    imageSrc: "github-repo.png",
    browserUrl: githubUrl,
  };
  delete script.slides[1].title;
  delete script.slides[1].subtitle;

  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`✓ patched ${slug}`);

  // Cập nhật review-input.json: ghi rõ ảnh giờ là screenshot thật, không phải Pexels
  const reviewPath = path.join(KIT_ROOT, "out", slug, "review-input.json");
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  review.checks.copyright.notes =
    "Ảnh là screenshot thật của website chính thức và trang GitHub repo (chụp qua Playwright), không dùng ảnh stock/Pexels. Nội dung hiển thị đúng công khai trên các trang này.";
  review.checks.visual_feasibility.notes =
    "Dùng composition image imageMode=screen (khung trình duyệt) với ảnh chụp thật từ website + GitHub, browserUrl khớp domain thật.";
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2));
}

console.log("done.");
