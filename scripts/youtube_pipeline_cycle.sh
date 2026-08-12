#!/usr/bin/env bash
# youtube_pipeline_cycle.sh — chạy ĐÚNG 1 chu kỳ youtube_pipeline.mjs rồi
# thoát. Dùng để đăng ký Windows Task Scheduler / GitHub Actions cron, cùng
# pattern lock-file/log RIÊNG với 2 pipeline trước (auto-pipeline, news-
# pipeline) để không tranh nhau / không đọc nhầm state của nhau.
#
# YOUTUBE_CHANNEL_ID PHẢI được set (channel đã có quyền/giấy phép reup) —
# script KHÔNG có default, cố tình không tự chọn channel nào cả.
set -uo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

if [ -z "${YOUTUBE_CHANNEL_ID:-}" ]; then
  echo "thiếu env YOUTUBE_CHANNEL_ID (channel đã có quyền reup) -> dừng." >&2
  exit 1
fi

LOCK="out/.youtube-pipeline-cycle.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "cycle trước vẫn đang chạy (pid $(cat "$LOCK")) — thoát, cron sẽ tự thử lại lần sau." >&2
  exit 1
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

export PYTHON="${PYTHON:-python}"
export PYTHONIOENCODING="utf-8"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_LANGUAGE="${WHISPER_LANGUAGE:-vi}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MAX_CLIPS="${YOUTUBE_PIPELINE_MAX_CLIPS:-1}"

LOG="out/youtube-pipeline.log"
echo "--- cycle (task scheduler): $(date) channel=$YOUTUBE_CHANNEL_ID max=$MAX_CLIPS ---" >> "$LOG"
node scripts/youtube_pipeline.mjs --channel-id "$YOUTUBE_CHANNEL_ID" --max-clips "$MAX_CLIPS" >> "$LOG" 2>&1
echo "--- cycle done: $(date) ---" >> "$LOG"
