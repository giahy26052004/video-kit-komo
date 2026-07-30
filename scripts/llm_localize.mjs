#!/usr/bin/env node
/**
 * llm_localize.mjs — Dịch/tóm tắt nội dung tiếng Anh (description GitHub,
 * release notes, tiêu đề Hacker News) thành tiếng Việt tự nhiên, TÁCH RIÊNG
 * bản ngắn cho on-screen text (3-8 từ, không câu dài) và bản đầy đủ cho
 * voice_text — đúng nguyên tắc Shorts: voice truyền tải nội dung, chữ trên
 * màn hình chỉ là từ khoá.
 *
 * Gọi qua endpoint KomoAPI (9Router) — OpenAI-compatible /v1/chat/completions,
 * KHÔNG lưu key trong code, chỉ đọc từ env KOMOAPI_LLM_KEY/KOMOAPI_LLM_URL.
 *
 * Nếu API lỗi (mạng, hết quota...) -> fallback về bản tiếng Anh gốc (cắt gọn),
 * KHÔNG làm crash cả cycle — video vẫn ra được, chỉ kém tự nhiên hơn.
 */

const LLM_URL = process.env.KOMOAPI_LLM_URL;
const LLM_KEY = process.env.KOMOAPI_LLM_KEY;
const LLM_MODEL = process.env.KOMOAPI_LLM_MODEL || "cc/claude-haiku-4-5-20251001";

function truncate(text, maxLen) {
  const t = (text || "").trim();
  return t.length > maxLen ? `${t.slice(0, maxLen).trim()}...` : t;
}

function fallback(gh, hn) {
  return {
    desc_onscreen: truncate(gh.description, 40),
    desc_voice: truncate(gh.description, 200),
    release_onscreen: "Có gì mới?",
    release_highlights: gh.latestRelease ? [truncate(gh.latestRelease.name, 40)] : [],
    release_voice: truncate(gh.latestRelease?.body, 200),
    hn_onscreen: hn ? truncate(hn.title, 40) : "",
    hn_voice: hn ? truncate(hn.title, 150) : "",
    fb_caption: truncate(gh.description, 100) || gh.name,
  };
}

/**
 * @param {object} gh - research.github (name, description, latestRelease)
 * @param {object|null} hn - research.hackernews
 * @returns {Promise<object>} { desc_onscreen, desc_voice, release_onscreen, release_highlights, release_voice, hn_onscreen, hn_voice }
 */
export async function localizeContent(gh, hn) {
  if (!LLM_URL || !LLM_KEY) {
    console.warn("  [llm] thiếu KOMOAPI_LLM_URL/KOMOAPI_LLM_KEY -> dùng fallback tiếng Anh cắt gọn");
    return fallback(gh, hn);
  }

  const fields = {
    repo_description_en: gh.description || null,
    latest_release_name_en: gh.latestRelease?.name || null,
    latest_release_body_en: gh.latestRelease ? truncate(gh.latestRelease.body, 800) : null,
    hackernews_title_en: hn?.title || null,
  };

  const prompt = `Bạn là biên tập viên viết script video ngắn (TikTok/Reels) tiếng Việt về công nghệ AI.
Dịch và VIẾT LẠI (không dịch máy word-by-word) nội dung tiếng Anh sau thành tiếng Việt tự nhiên, dễ hiểu.
KHÔNG bao giờ render nguyên văn markdown/changelog GitHub (vd "What's Changed", "ci: guard...", "merge pull request...") — luôn diễn giải lại thành ý nghĩa thực tế cho người xem phổ thông, không dùng thuật ngữ Git (PR, merge, CI, commit...).

Input (JSON):
${JSON.stringify(fields, null, 2)}

Trả về DUY NHẤT 1 object JSON (không markdown, không giải thích thêm) với các field:
- "desc_onscreen": tóm tắt repo_description_en thành 3-8 từ tiếng Việt, không dấu chấm cuối, dùng làm chữ hiện trên màn hình (chỉ điền nếu repo_description_en có giá trị)
- "desc_voice": viết lại repo_description_en thành 1 câu tiếng Việt tự nhiên, đầy đủ ý, 15-30 từ, dùng để đọc giọng (chỉ điền nếu repo_description_en có giá trị)
- "release_onscreen": tiêu đề ngắn 2-4 từ cho slide "có gì mới" (vd "Có gì mới?") (chỉ điền nếu có latest_release_name_en)
- "release_highlights": mảng ĐÚNG 2-3 chuỗi tiếng Việt (không hơn), MỖI chuỗi tối đa 5 từ, mỗi chuỗi là 1 điểm mới thực tế (tính năng/cải tiến/sửa lỗi quan trọng nhất) diễn giải từ latest_release_body_en — KHÔNG phải câu markdown gốc, không thuật ngữ Git. Ví dụ: ["Tăng tốc nhận diện", "Sửa lỗi cắt video"] (mảng rỗng nếu không có latest_release_name_en)
- "release_voice": 1 đoạn tiếng Việt tự nhiên (2-3 câu, 30-50 từ) kể lại đầy đủ các điểm mới trong release_highlights theo giọng văn nói chuyện, dùng để đọc giọng (chỉ điền nếu có)
- "hn_onscreen": nhãn ngắn 3-6 từ (vd "Đang hot trên Hacker News") (chỉ điền nếu có hackernews_title_en)
- "hn_voice": 1 câu tiếng Việt tự nhiên giới thiệu chủ đề đang bàn luận, dịch ý chính của hackernews_title_en, 15-25 từ (chỉ điền nếu có)
- "fb_caption": 1 câu tiếng Việt TỰ NHIÊN dùng làm caption đăng Facebook (như 1 người thật viết, không phải tiêu đề kỹ thuật) — tập trung vào ĐIỂM HAY NHẤT/gây tò mò nhất của repo này, 10-20 từ, KHÔNG ghi tên repo dạng "owner/repo", KHÔNG ghi số sao, không hashtag, không dấu ngoặc kép

Field nào input là null thì trả về "" (hoặc [] cho release_highlights) cho field tương ứng. KHÔNG bịa thêm thông tin ngoài input.`;

  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        max_tokens: 1200,
        messages: [
          { role: "system", content: "Trả lời CHỈ 1 object JSON hợp lệ, không markdown code fence, không giải thích." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(content);
    console.log("  [llm] đã dịch/tóm tắt nội dung sang tiếng Việt");
    return { ...fallback(gh, hn), ...parsed };
  } catch (e) {
    console.warn(`  [llm] gọi LLM thất bại (${e.message}) -> dùng fallback tiếng Anh cắt gọn`);
    return fallback(gh, hn);
  }
}

/**
 * Gợi ý 1 từ khoá tìm kiếm GitHub MỚI, dựa trên danh sách chủ đề đã làm rồi
 * (usedRepos) — để nội dung đa dạng, đỡ lặp lại quanh vài mảng cũ, và tìm
 * được những mảng "hay ho" người xem thật sự cần biết chứ không chỉ xoay
 * vòng list cứng. Trả về null nếu LLM lỗi -> auto_pipeline.mjs tự fallback
 * về QUERY_POOL cố định.
 *
 * @param {string[]} usedRepos - danh sách "owner/repo" đã từng làm video
 * @returns {Promise<string|null>} cụm từ khoá tiếng Anh ngắn (vd "ai agent")
 */
export async function suggestSearchQuery(usedRepos) {
  if (!LLM_URL || !LLM_KEY) return null;

  const recentlyUsed = usedRepos.slice(-40);
  const prompt = `Bạn đang giúp 1 kênh TikTok/Reels tự động tìm chủ đề công nghệ đang hot để làm video ngắn giới thiệu.
Phạm vi chủ đề: AI/machine learning, VÀ CẢ blockchain/crypto/web3, developer tools nói chung.

Các repo GitHub đã làm video rồi (KHÔNG được gợi ý trùng mảng công nghệ này nữa):
${recentlyUsed.join(", ") || "(chưa có)"}

Hãy nghĩ ra 1 cụm từ khoá tiếng Anh NGẮN (2-4 từ, dùng để tìm trên GitHub Search API), thuộc một mảng công nghệ (AI hoặc crypto/blockchain/web3 hoặc dev tools) đang được nhiều người quan tâm nhưng KHÁC với các mảng đã liệt kê ở trên. Ưu tiên mảng thiết thực, người xem phổ thông cũng thấy hữu ích (không quá học thuật/ngách hẹp).

Trả lời DUY NHẤT cụm từ khoá đó, không giải thích, không dấu ngoặc kép, không markdown.`;

  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        max_tokens: 30,
        messages: [
          { role: "system", content: "Trả lời NGẮN GỌN, chỉ 1 cụm từ khoá, không giải thích." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim();
    const query = raw.replace(/^["'`]|["'`.]$/g, "").toLowerCase().trim();
    if (!query || query.length > 60) return null;
    console.log(`  [llm] gợi ý chủ đề mới: "${query}"`);
    return query;
  } catch (e) {
    console.warn(`  [llm] gợi ý chủ đề thất bại (${e.message}) -> dùng QUERY_POOL cố định`);
    return null;
  }
}
