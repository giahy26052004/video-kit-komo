#!/usr/bin/env bash
# batch_render.sh — review + render tuần tự các project AI-trending qua đêm.
# Có lockfile (chống 2 lần chạy chồng nhau) và retry cứng trong code:
# nếu gặp lỗi kiểu hết quota / rate-limit / API tạm thời lỗi, đợi 4 tiếng
# rồi tự kiểm tra lại, tối đa 6 lần (24 tiếng) trước khi bỏ qua project đó.
set -uo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

LOCK="out/.batch-render.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "batch_render.sh đã chạy rồi (pid $(cat "$LOCK")) — thoát để tránh chạy chồng." >&2
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
export PEXELS_API_KEY="xgaBfhLmA0vqL6DsYcviZrhALnZ4OjynyAWs73M4KjVviiprbRUf6vtX"

PROJECTS=(text-to-speech-ai ai-voice-clone multimodal-ai)

RETRY_WAIT_SECONDS=14400   # 4 tiếng — hardcode theo yêu cầu, không dùng cron ngoài
MAX_RETRIES=6              # tối đa 6 lần chờ = 24 tiếng trước khi bỏ qua

# Các dấu hiệu lỗi tạm thời do hết quota / rate-limit / API tạm nghẽn —
# đáng để chờ rồi thử lại, khác với lỗi cấu hình/script sai (không nên retry mù).
is_retryable_error() {
  grep -qiE "rate limit|too many requests|quota|usage limit|429|NoAudioReceived|ECONNRESET|ETIMEDOUT|503|502" "$1"
}

render_with_retry() {
  local project="$1"
  local log="$2"
  local attempt=0
  while true; do
    if node scripts/video-explainer.mjs render "$project" >> "$log" 2>&1; then
      return 0
    fi
    if is_retryable_error "$log" && [ "$attempt" -lt "$MAX_RETRIES" ]; then
      attempt=$((attempt + 1))
      echo "  render: gặp lỗi tạm thời (quota/rate-limit) — đợi 4 tiếng rồi thử lại (lần $attempt/$MAX_RETRIES)..." | tee -a "$SUMMARY"
      sleep "$RETRY_WAIT_SECONDS"
      continue
    fi
    return 1
  done
}

SUMMARY="out/batch-render.log"
: > "$SUMMARY"
echo "batch render start: $(date)" | tee -a "$SUMMARY"

for slug in "${PROJECTS[@]}"; do
  PROJECT="out/$slug"
  LOG="$PROJECT/render.log"
  echo "=== $slug ===" | tee -a "$SUMMARY"

  if node scripts/video-explainer.mjs review "$PROJECT" > "$LOG" 2>&1; then
    echo "  review: pass" | tee -a "$SUMMARY"
  else
    echo "  review: FAILED (see $LOG)" | tee -a "$SUMMARY"
    continue
  fi

  if render_with_retry "$PROJECT" "$LOG"; then
    echo "  render: OK" | tee -a "$SUMMARY"
  else
    echo "  render: FAILED (see $LOG)" | tee -a "$SUMMARY"
  fi
done

echo "rebuilding gallery..." | tee -a "$SUMMARY"
node scripts/build_gallery.mjs | tee -a "$SUMMARY"

echo "batch render done: $(date)" | tee -a "$SUMMARY"
