#!/usr/bin/env bash
# auto_pipeline_loop.sh — lặp vô hạn: cứ 2 tiếng chạy 1 chu kỳ auto_pipeline.mjs
# (research chủ đề mới -> viết script -> chụp ảnh thật -> render -> post Facebook).
# Lịch chạy hardcode trong code này (không dùng cron ngoài) theo yêu cầu.
set -uo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

LOCK="out/.auto-pipeline-loop.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "auto_pipeline_loop.sh đã chạy rồi (pid $(cat "$LOCK")) — thoát." >&2
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
# FB_PAGE_ACCESS_TOKEN: đọc từ .env nếu có, không hardcode token vào script.
if [ -f .env ] && grep -q "^FB_PAGE_ACCESS_TOKEN=" .env; then
  export FB_PAGE_ACCESS_TOKEN="$(grep '^FB_PAGE_ACCESS_TOKEN=' .env | head -1 | cut -d= -f2-)"
fi

CYCLE_SECONDS=7200  # 2 tiếng — hardcode theo yêu cầu

LOG="out/auto-pipeline.log"
echo "=== auto pipeline loop start: $(date) ===" >> "$LOG"

while true; do
  echo "--- cycle: $(date) ---" | tee -a "$LOG"
  node scripts/auto_pipeline.mjs >> "$LOG" 2>&1
  echo "--- cycle done, ngủ 2 tiếng: $(date) ---" | tee -a "$LOG"
  sleep "$CYCLE_SECONDS"
done
