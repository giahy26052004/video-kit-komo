#!/usr/bin/env node
/**
 * llm_news_writer.mjs — Viết script Reel tin tức (title/slide/caption/hashtag)
 * từ 1 chủ đề đã chấm điểm (score_topics.mjs) + các bài báo liên quan, qua
 * KomoAPI (cùng pattern gọi API như llm_localize.mjs, key đọc từ env, KHÔNG
 * lưu trong code).
 *
 * QUAN TRỌNG: bắt buộc LLM tự đánh giá độ tin cậy (confirmed/confirmationNote)
 * — không được biến tin đồn/phát ngôn 1 phía thành khẳng định, đặc biệt với
 * chủ đề "drama" (nhân vật/vụ việc gây tranh cãi, pháp lý). news_pipeline.mjs
 * dùng field confirmed này kết hợp sourceCount làm ngưỡng an toàn cứng trước
 * khi cho phép auto-publish (xem hàm main() ở đó).
 */
const LLM_URL = process.env.KOMOAPI_LLM_URL;
const LLM_KEY = process.env.KOMOAPI_LLM_KEY;
const LLM_MODEL = process.env.KOMOAPI_LLM_MODEL || "cc/claude-haiku-4-5-20251001";

function fallbackScript(topic) {
  const items = topic.items.slice(0, 5);
  return {
    title_onscreen: topic.title.slice(0, 60),
    hook_voice: topic.title,
    slides: items.map((it) => ({
      text_onscreen: it.title.slice(0, 40),
      voice_text: it.summary || it.title,
      visual_query: "vietnam city news broadcast",
    })),
    fbCaption: topic.title,
    hashtags: ["TinTuc", "VietNam", "TinMoiNhat"],
    confirmed: topic.sourceCount >= 2,
    confirmationNote: topic.sourceCount >= 2
      ? `Có ${topic.sourceCount} nguồn (${topic.sources.join(", ")}) cùng đưa tin.`
      : "Chỉ 1 nguồn đưa tin — chưa đủ chéo kiểm, cần thêm nguồn xác nhận.",
  };
}

/**
 * @param {object} topic - 1 phần tử trả về từ scoreTopics() (score_topics.mjs)
 * @returns {Promise<{title_onscreen,hook_voice,slides:Array<{text_onscreen,voice_text,visual_query}>,fbCaption,hashtags:string[],confirmed:boolean,confirmationNote:string}>}
 */
export async function writeNewsScript(topic) {
  if (!LLM_URL || !LLM_KEY) {
    console.warn("  [llm_news] thiếu KOMOAPI_LLM_URL/KOMOAPI_LLM_KEY -> dùng fallback đơn giản");
    return fallbackScript(topic);
  }

  const sources = topic.items.slice(0, 6).map((it) => ({
    source: it.source,
    title: it.title,
    summary: it.summary,
    link: it.link,
    pubDate: it.pubDate,
  }));

  const prompt = `Bạn là biên tập viên viết script video ngắn (Facebook Reels, 40-60 giây) tiếng Việt về tin tức đang hot tại Việt Nam.

Chủ đề: "${topic.title}"
Nhóm: ${topic.categoryLabel}
Số nguồn báo độc lập đưa tin: ${topic.sourceCount}

Các bài báo liên quan (JSON, dữ liệu THẬT lấy từ RSS báo chính thống — CHỈ dùng thông tin có trong đây, KHÔNG bịa thêm số liệu/chi tiết/lời trích dẫn nào khác):
${JSON.stringify(sources, null, 2)}

YÊU CẦU QUAN TRỌNG NHẤT VỀ ĐỘ TIN CẬY: Phân biệt rõ thông tin đã được nhiều nguồn xác nhận và thông tin mới lan truyền/phát ngôn 1 phía/chưa kiểm chứng — đặc biệt nếu chủ đề liên quan tới 1 vụ việc/nhân vật gây tranh cãi hoặc pháp lý. Nếu không chắc, PHẢI viết dè dặt ("theo thông tin đang lan truyền...", "chưa được xác nhận chính thức...", "theo phát ngôn của...") — TUYỆT ĐỐI không khẳng định 1 tin đồn hay lời kể 1 phía là sự thật hiển nhiên.

Viết theo khung: (1) tin gì vừa xảy ra, (2) tại sao nó xảy ra / bối cảnh, (3) ảnh hưởng tới ai, (4) có con số/chi tiết đáng chú ý nào không (chỉ nêu số liệu có thật trong bài báo trên), (5) tóm lại vì sao đang được quan tâm. Giọng văn nói chuyện tự nhiên, ngắn gọn, KHÔNG đọc lại nguyên văn bài báo.

Trả về DUY NHẤT 1 object JSON (không markdown, không giải thích thêm) với các field:
- "title_onscreen": tiêu đề hấp dẫn 4-8 từ hiện đầu video (có thể có 1 emoji đầu)
- "hook_voice": 1 câu mở đầu gây chú ý, đọc giọng (10-20 từ)
- "slides": mảng ĐÚNG 5-7 object {"text_onscreen": tối đa 8 từ hiện trên màn hình, "voice_text": 1-2 câu 20-40 từ đọc giọng, "visual_query": 3-6 từ TIẾNG ANH mô tả 1 HÌNH ẢNH/CẢNH QUAY chung (không phải chữ/số liệu) để tìm B-roll trên kho stock video Pexels — ví dụ "city skyline construction crane", "bank office signing documents", "stock market screen numbers", "football stadium crowd cheering", "person using smartphone night"} — đi theo đúng khung 5 phần ở trên, mỗi slide 1 ý
- "fbCaption": caption Facebook tự nhiên 2-4 câu, có 1-2 emoji, KHÔNG kèm hashtag (hashtag được thêm riêng ở field khác)
- "hashtags": mảng 4-6 hashtag tiếng Việt KHÔNG dấu, KHÔNG khoảng trắng, KHÔNG kèm ký tự #
- "confirmed": true CHỈ KHI thông tin cốt lõi được từ 2 nguồn độc lập trở lên xác nhận rõ ràng, false nếu chỉ 1 nguồn hoặc mang tính đồn đoán/phát ngôn cá nhân
- "confirmationNote": 1 câu ngắn tiếng Việt giải thích vì sao confirmed là true/false`;

  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        max_tokens: 2000,
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
    if (!Array.isArray(parsed.slides) || !parsed.slides.length) throw new Error("LLM không trả về slides hợp lệ");
    console.log(`  [llm_news] đã viết script cho "${topic.title}" (confirmed=${parsed.confirmed})`);
    return { ...fallbackScript(topic), ...parsed };
  } catch (e) {
    console.warn(`  [llm_news] gọi LLM thất bại (${e.message}) -> dùng fallback đơn giản`);
    return fallbackScript(topic);
  }
}
