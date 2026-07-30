#!/usr/bin/env bash
# auto_pipeline_cycle.sh — chạy ĐÚNG 1 chu kỳ auto_pipeline.mjs rồi thoát.
# Dùng để đăng ký với Windows Task Scheduler (chạy lại mỗi 2 tiếng bởi hệ điều
# hành) thay vì giữ 1 tiến trình bash sống mãi với sleep — bền hơn khi máy
# reboot / app Claude Code đóng, vì Task Scheduler là job hệ điều hành thật.
set -uo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

LOCK="out/.auto-pipeline-cycle.lock"
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
export PEXELS_API_KEY="xgaBfhLmA0vqL6DsYcviZrhALnZ4OjynyAWs73M4KjVviiprbRUf6vtX"
if [ -f .env ] && grep -q "^FB_PAGE_ACCESS_TOKEN=" .env; then
  export FB_PAGE_ACCESS_TOKEN="$(grep '^FB_PAGE_ACCESS_TOKEN=' .env | head -1 | cut -d= -f2-)"
fi

LOG="out/auto-pipeline.log"
echo "--- cycle (task scheduler): $(date) ---" >> "$LOG"
node scripts/auto_pipeline.mjs >> "$LOG" 2>&1
echo "--- cycle done: $(date) ---" >> "$LOG"
