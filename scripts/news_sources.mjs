#!/usr/bin/env node
/**
 * news_sources.mjs — Fetch tin tức Việt Nam đang hot theo 4 nhóm chủ đề, qua
 * RSS công khai của các báo lớn (KHÔNG cần API key, không scrape HTML).
 *
 *   🏠 bds        — dự án / bất động sản
 *   💰 tai-chinh  — tiền, ngân hàng, vay, chứng khoán
 *   🔥 drama      — nhân vật/vụ việc đang gây tranh luận (giải trí + pháp luật)
 *   ⚽ bongda     — bóng đá
 *
 * 1 feed lỗi (đổi URL, timeout, chặn bot...) chỉ log warning và bị bỏ qua —
 * KHÔNG làm hỏng cả lần chạy, vì luôn còn feed khác trong cùng nhóm.
 */
import Parser from "rss-parser";

const parser = new Parser({ timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } });

export const FEEDS = [
  { url: "https://vnexpress.net/rss/bat-dong-san.rss", source: "VnExpress", category: "bds" },
  { url: "https://cafef.vn/bat-dong-san.rss", source: "CafeF", category: "bds" },
  { url: "https://vnexpress.net/rss/kinh-doanh.rss", source: "VnExpress", category: "tai-chinh" },
  { url: "https://cafef.vn/thi-truong-chung-khoan.rss", source: "CafeF", category: "tai-chinh" },
  { url: "https://cafef.vn/tai-chinh-ngan-hang.rss", source: "CafeF", category: "tai-chinh" },
  { url: "https://vietstock.vn/144/chung-khoan.rss", source: "Vietstock", category: "tai-chinh" },
  { url: "https://vnexpress.net/rss/giai-tri.rss", source: "VnExpress", category: "drama" },
  { url: "https://vnexpress.net/rss/phap-luat.rss", source: "VnExpress", category: "drama" },
  { url: "https://znews.vn/rss/giai-tri.rss", source: "Znews", category: "drama" },
  { url: "https://vnexpress.net/rss/the-thao.rss", source: "VnExpress", category: "bongda" },
  { url: "https://znews.vn/rss/the-thao.rss", source: "Znews", category: "bongda" },
];

export const CATEGORY_LABEL = {
  bds: "🏠 Dự án / Bất động sản",
  "tai-chinh": "💰 Tiền – ngân hàng – vay",
  drama: "🔥 Drama / nhân vật",
  bongda: "⚽ Bóng đá",
};

function normalizeItem(feedItem, feed) {
  return {
    title: (feedItem.title || "").trim(),
    summary: (feedItem.contentSnippet || feedItem.summary || feedItem.content || "").trim().slice(0, 500),
    link: feedItem.link || "",
    source: feed.source,
    category: feed.category,
    pubDate: feedItem.isoDate || feedItem.pubDate || null,
  };
}

/**
 * Tải + parse toàn bộ FEEDS song song, gộp kết quả. Feed nào lỗi thì trả []
 * cho feed đó (không throw), giữ nguyên các feed còn lại.
 * @returns {Promise<Array<{title,summary,link,source,category,pubDate}>>}
 */
export async function fetchAllNews() {
  const results = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const items = (parsed.items || []).map((item) => normalizeItem(item, feed));
        console.error(`[news_sources] ${feed.source} (${feed.category}): ${items.length} bài`);
        return items;
      } catch (e) {
        console.warn(`[news_sources] lỗi feed ${feed.source} (${feed.url}): ${e.message}`);
        return [];
      }
    })
  );
  return results.flat().filter((item) => item.title);
}

async function main() {
  const items = await fetchAllNews();
  console.log(JSON.stringify(items, null, 2));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/news_sources.mjs");
if (isMain) main();
