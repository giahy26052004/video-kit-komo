#!/usr/bin/env bash
# news_pipeline_cycle.sh — chạy ĐÚNG 1 chu kỳ news_pipeline.mjs rồi thoát.
# Dùng để đăng ký với Windows Task Scheduler (chạy lại định kỳ, ví dụ mỗi 2-3
# tiếng, bởi hệ điều hành) thay vì giữ 1 tiến trình bash sống mãi — bền hơn
# khi máy reboot / app Claude Code đóng, vì Task Scheduler là job hệ điều
# hành thật. Cùng pattern lock file với auto_pipeline_cycle.sh, nhưng lock/log
# RIÊNG để 2 pipeline (GitHub trending & tin tức VN) chạy độc lập, không tranh
# nhau / không đọc nhầm state của nhau.
set -uo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

LOCK="out/.news-pipeline-cycle.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "cycle trước vẫn đang chạy (pid $(cat "$LOCK")) — thoát, Task Scheduler sẽ tự thử lại lần sau." >&2
  exit 1
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

export PYTHON="${PYTHON:-python}"
export PYTHONIOENCODING="utf-8"
export TTS_BACKEND="edge"
export EDGE_TTS_VOICE="vi-VN-NamMinhNeural"
export EDGE_TTS_RATE="+50%"
export WHISPER_MODEL="base"
export WHISPER_LANGUAGE="vi"

# KOMOAPI_LLM_*, PEXELS_API_KEY, FB_PAGE_ACCESS_TOKEN đọc từ .env (không
# hardcode key trong script này) — .env nằm ngoài git, xem .env.example.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Số Reel tối đa mỗi chu kỳ — mặc định 5, đổi qua biến env NEWS_PIPELINE_TOP
# khi đăng ký Task Scheduler nếu muốn nhịp khác.
TOP="${NEWS_PIPELINE_TOP:-5}"

LOG="out/news-pipeline.log"
echo "--- cycle (task scheduler): $(date) top=$TOP ---" >> "$LOG"
node scripts/news_pipeline.mjs --top "$TOP" >> "$LOG" 2>&1
echo "--- cycle done: $(date) ---" >> "$LOG"
