#!/usr/bin/env node
/**
 * score_topics.mjs — Nhóm các bài báo (news_sources.mjs) cùng nói về 1 chủ đề
 * dù tiêu đề viết khác nhau ở từng báo, rồi chấm điểm "độ hot" — ưu tiên chủ
 * đề xuất hiện ĐỒNG THỜI trên nhiều nguồn (tín hiệu trend thật, không chỉ 1
 * báo tự đăng) + còn mới + khớp các mẫu câu dễ viral.
 */
import { fetchAllNews, CATEGORY_LABEL } from "./news_sources.mjs";

const VIRAL_PATTERNS = [
  /tại sao/i, /vì sao/i, /có nên/i, /bao nhiêu/i, /bị ảnh hưởng/i,
  /tăng giá/i, /giảm giá/i, /siết/i, /cấm/i, /mới nhất/i, /thay đổi/i,
  /ai được lợi/i, /ai bị ảnh hưởng/i, /gây tranh cãi/i, /gây chú ý/i,
  /khởi công/i, /động thổ/i, /đình trệ/i, /tháo gỡ/i, /sốt đất/i, /vỡ nợ/i,
];

const CATEGORY_WEIGHT = { bds: 1, "tai-chinh": 1, drama: 0.9, bongda: 0.85 };

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d");
}

function normalizeTitle(title) {
  return stripDiacritics(title.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .sort()
    .join(" ");
}

function tokenSimilarity(a, b) {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.min(setA.size, setB.size);
}

/**
 * Nhóm các item có tiêu đề (đã chuẩn hoá) giống nhau >=50% token — coi là
 * cùng 1 chủ đề. CHỈ gộp trong cùng 1 category — tiêu đề ngắn (ít token) dễ
 * "giống" nhau ngẫu nhiên qua các category khác hẳn nhau (vd tin bóng đá và
 * tin bất động sản trùng vài từ chung), gộp xuyên category sẽ ra chủ đề bị
 * gắn nhãn sai và trộn lẫn nguồn không liên quan cho LLM viết content.
 */
function groupBySimilarTopic(items) {
  const groups = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    const group = groups.find((g) => g.category === item.category && tokenSimilarity(g.key, key) >= 0.5);
    if (group) group.items.push(item);
    else groups.push({ key, category: item.category, items: [item] });
  }
  return groups;
}

function freshnessScore(items) {
  const newest = items
    .map((i) => (i.pubDate ? new Date(i.pubDate).getTime() : 0))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  if (!newest) return 50;
  const hoursAgo = (Date.now() - newest) / 3_600_000;
  if (hoursAgo <= 3) return 100;
  if (hoursAgo <= 12) return 85;
  if (hoursAgo <= 24) return 70;
  if (hoursAgo <= 48) return 50;
  return 30;
}

// 1 nguồn=35đ, 2 nguồn=70đ, >=3 nguồn=100đ — đúng ý tưởng "đa nguồn = trend thật".
function sourceCountScore(sourceCount) {
  return Math.min(100, sourceCount * 35);
}

function viralPatternScore(items) {
  const text = items.map((i) => `${i.title} ${i.summary}`).join(" ");
  const matches = VIRAL_PATTERNS.filter((re) => re.test(text)).length;
  return Math.min(100, matches * 25);
}

/**
 * @param {Array} items - từ fetchAllNews()
 * @param {string[]} usedTopicKeys - key (normalizeTitle) của các chủ đề đã làm rồi, để loại bỏ
 * @param {number} topN
 * @returns {Array<{topicKey,title,category,categoryLabel,sourceCount,sources,score,freshness,viral,items}>}
 */
export function scoreTopics(items, usedTopicKeys = [], topN = 10) {
  const usedSet = new Set(usedTopicKeys);
  const groups = groupBySimilarTopic(items).filter((g) => !usedSet.has(g.key));

  const scored = groups.map((g) => {
    const sources = [...new Set(g.items.map((i) => i.source))];
    const category = g.category;
    const freshness = freshnessScore(g.items);
    const sourceScore = sourceCountScore(sources.length);
    const viral = viralPatternScore(g.items);
    const weight = CATEGORY_WEIGHT[category] ?? 1;
    const score = Math.round((freshness * 0.3 + sourceScore * 0.35 + viral * 0.35) * weight);
    // Tiêu đề đại diện: bài có summary dài nhất (thường là bản viết đầy đủ nhất).
    const best = g.items.reduce((a, b) => (a.summary.length >= b.summary.length ? a : b));
    return {
      topicKey: g.key,
      title: best.title,
      category,
      categoryLabel: CATEGORY_LABEL[category] || category,
      sourceCount: sources.length,
      sources,
      score,
      freshness,
      viral,
      items: g.items,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

async function main() {
  const items = await fetchAllNews();
  const top = scoreTopics(items, [], 10).map((t) => ({
    title: t.title,
    category: t.categoryLabel,
    sourceCount: t.sourceCount,
    sources: t.sources,
    score: t.score,
  }));
  console.log(JSON.stringify(top, null, 2));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/score_topics.mjs");
if (isMain) main();
