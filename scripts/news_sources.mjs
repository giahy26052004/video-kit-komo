#!/usr/bin/env node
/**
 * news_sources.mjs — Fetch tin tức Việt Nam đang hot theo 7 nhóm chủ đề, qua
 * RSS công khai của các báo lớn (KHÔNG cần API key, không scrape HTML).
 *
 *   🏠 bds        — dự án / bất động sản
 *   💰 tai-chinh  — tiền, ngân hàng, vay, chứng khoán
 *   🔥 drama      — nhân vật/vụ việc đang gây tranh luận (giải trí + pháp luật)
 *   ⚽ bongda     — bóng đá
 *   🌍 the-gioi   — tin thế giới
 *   💹 crypto     — tiền số / crypto
 *   🤖 ai         — công nghệ / AI
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
  // Source riêng cho drama sao Việt/idol TikTok (khác nguồn tin giải trí/pháp
  // luật chung ở trên) — bắt đúng loại tin "beef nghệ sĩ", "idol TikTok" mà
  // 2 feed VnExpress/Znews tổng hợp phía trên có thể bỏ sót vì quá chung.
  { url: "https://kenh14.vn/star.rss", source: "Kenh14", category: "drama" },
  { url: "https://vietnamnet.vn/rss/giai-tri.rss", source: "VietnamNet", category: "drama" },
  { url: "https://vnexpress.net/rss/the-thao.rss", source: "VnExpress", category: "bongda" },
  { url: "https://znews.vn/rss/the-thao.rss", source: "Znews", category: "bongda" },
  { url: "https://vnexpress.net/rss/the-gioi.rss", source: "VnExpress", category: "the-gioi" },
  { url: "https://znews.vn/rss/the-gioi.rss", source: "Znews", category: "the-gioi" },
  { url: "https://vn.investing.com/rss/news_301.rss", source: "Investing.com", category: "crypto" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph", category: "crypto" },
  { url: "https://vnexpress.net/rss/so-hoa.rss", source: "VnExpress", category: "ai" },
  { url: "https://genk.vn/rss/home.rss", source: "GenK", category: "ai" },
];

export const CATEGORY_LABEL = {
  bds: "🏠 Dự án / Bất động sản",
  "tai-chinh": "💰 Tiền – ngân hàng – vay",
  drama: "🔥 Drama / nhân vật",
  bongda: "⚽ Bóng đá",
  "the-gioi": "🌍 Thế giới",
  crypto: "💹 Crypto / tiền số",
  ai: "🤖 Công nghệ / AI",
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
