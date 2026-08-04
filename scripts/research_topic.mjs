#!/usr/bin/env node
/**
 * research_topic.mjs — Tìm 1 chủ đề AI đang "hot" từ nguồn THẬT (không scrape,
 * chỉ dùng API chính thức, public, không cần đăng nhập):
 *
 *   - GitHub Search API  (repos hoạt động gần đây, sort theo sao)
 *   - Hacker News API    (Firebase public API chính thức của HN)
 *
 * Output: research/<slug>.json — dữ liệu thô (README, release notes, HN posts)
 * để bước sau (Claude viết script.json) đọc và tóm tắt.
 *
 * Usage:
 *   node scripts/research_topic.mjs "ai agent"
 *   node scripts/research_topic.mjs "ai agent" --days 7 --min-stars 500
 *   node scripts/research_topic.mjs "ai agent" --exclude "owner/repo1,owner/repo2"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "claude-video-kit-research/1.0" };
// Không xác thực -> GitHub Search API chỉ cho 10 req/phút, hết rất nhanh khi
// pickTopic() thử nhiều query liên tiếp (=> toàn bộ vòng lặp bị 403). Có token
// (kể cả GITHUB_TOKEN mặc định của Actions) nâng lên 30 req/phút cho search
// và 5000 req/giờ cho API thường.
const GH_AUTH = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}` }
  : {};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}
async function fetchText(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers } });
  if (!r.ok) return null; // README có thể 404 (repo không có README) — không fatal
  return r.text();
}

/**
 * Nguồn 1 — GitHub Search API: repo AI hoạt động gần đây, nhiều sao nhất.
 *
 * `excludeSet` (Set<string> tên "owner/repo" đã đăng video rồi) — lấy top 5
 * kết quả rồi chọn cái ĐẦU TIÊN chưa dùng, thay vì chỉ nhìn top[0]. Không có
 * bước này thì cùng 1 query gần như luôn ra đúng 1 repo (top sao ít đổi trong
 * 14 ngày), nên sau vài chục lần chạy, MỌI query trong QUERY_POOL đều bị coi
 * là "hết chủ đề mới" dù GitHub vẫn còn 4 kết quả khác chưa từng dùng.
 */
async function findTopGithubRepo(query, days, minStars, excludeSet = new Set()) {
  const since = isoDaysAgo(days);
  const q = encodeURIComponent(`${query} pushed:>${since} stars:>=${minStars}`);
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`;
  const data = await fetchJson(url, GH_AUTH);
  const items = data.items ?? [];
  if (!items.length) return null;

  const top = items.find((r) => !excludeSet.has(r.full_name)) ?? items[0];
  const readme = await fetchText(
    `https://raw.githubusercontent.com/${top.full_name}/${top.default_branch}/README.md`
  );

  let latestRelease = null;
  try {
    latestRelease = await fetchJson(`https://api.github.com/repos/${top.full_name}/releases/latest`, GH_AUTH);
  } catch { /* repo có thể chưa release lần nào — bỏ qua */ }

  return {
    source: "github",
    name: top.full_name,
    description: top.description,
    url: top.html_url,
    stars: top.stargazers_count,
    language: top.language,
    homepage: top.homepage || null,
    avatarUrl: top.owner?.avatar_url,
    pushedAt: top.pushed_at,
    readmeExcerpt: readme ? readme.slice(0, 6000) : null,
    latestRelease: latestRelease
      ? { tag: latestRelease.tag_name, name: latestRelease.name, body: (latestRelease.body ?? "").slice(0, 3000) }
      : null,
    otherCandidates: items.filter((r) => r.full_name !== top.full_name).map((r) => ({
      name: r.full_name, stars: r.stargazers_count, description: r.description,
    })),
  };
}

/** Nguồn 2 — Hacker News Firebase API (chính thức, public, không cần key). */
async function findTopHackerNewsPost(query) {
  // HN không có "search theo từ khoá" trong Firebase API thuần, nhưng Algolia
  // (chính thức được HN dùng làm search backend) có endpoint public read-only.
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=points%3E50`;
  const data = await fetchJson(url);
  const hits = data.hits ?? [];
  if (!hits.length) return null;
  const top = hits[0];
  return {
    source: "hackernews",
    title: top.title,
    url: top.url,
    hnUrl: `https://news.ycombinator.com/item?id=${top.objectID}`,
    points: top.points,
    numComments: top.num_comments,
    createdAt: top.created_at,
  };
}

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('usage: research_topic.mjs "<query>" [--days 7] [--min-stars 200]');
    process.exit(1);
  }
  const days = Number(arg("days", "7"));
  const minStars = Number(arg("min-stars", "200"));
  const excludeSet = new Set((arg("exclude", "") || "").split(",").map((s) => s.trim()).filter(Boolean));

  console.log(`Tìm kiếm chủ đề: "${query}" (${days} ngày gần nhất, >=${minStars} sao)...`);

  const [github, hackernews] = await Promise.all([
    findTopGithubRepo(query, days, minStars, excludeSet).catch((e) => { console.warn("github lỗi:", e.message); return null; }),
    findTopHackerNewsPost(query).catch((e) => { console.warn("hackernews lỗi:", e.message); return null; }),
  ]);

  if (!github && !hackernews) {
    console.error("Không tìm thấy kết quả nào — thử query khác hoặc hạ --min-stars.");
    process.exit(1);
  }

  const result = { query, days, minStars, fetchedAt: new Date().toISOString(), github, hackernews };

  const outDir = path.join(KIT_ROOT, "research");
  fs.mkdirSync(outDir, { recursive: true });
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const outPath = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`-> ${outPath}`);
  if (github) console.log(`GitHub: ${github.name} (${github.stars} sao) - ${github.url}`);
  if (hackernews) console.log(`HN: ${hackernews.title} (${hackernews.points} points) - ${hackernews.hnUrl}`);
}

main();
