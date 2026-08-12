#!/usr/bin/env python3
"""
whisper_srt.py — Transcribe 1 audio/video BẤT KỲ (không phụ thuộc cấu trúc
project Remotion, khác `align.py` vốn gắn với workspace/*.wav theo slide) ra
file .srt mốc thời gian giây thật. Dùng cho pipeline YouTube -> Reels
(scripts/reels_splitter.mjs tự cắt/offset phần .srt tương ứng mỗi đoạn sau).

faster-whisper tự decode audio track trực tiếp từ file video (mp4), không cần
tách audio riêng trước.

Usage: python scripts/whisper_srt.py <input_media> <output.srt> [--model base] [--language vi]
"""
import argparse
import os
from pathlib import Path

# Mặc định "vi" (khác align.py mặc định "zh" — align.py giữ default cũ để
# không phá pipeline video-explainer hiện có). Đổi qua env WHISPER_LANGUAGE
# nếu nguồn không phải tiếng Việt.
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "vi").strip() or "vi"
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base").strip() or "base"


def format_timestamp(seconds: float) -> str:
    total_ms = max(0, round(seconds * 1000))
    hours, rem_ms = divmod(total_ms, 3_600_000)
    minutes, rem_ms = divmod(rem_ms, 60_000)
    secs, ms = divmod(rem_ms, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_media")
    parser.add_argument("output_srt")
    parser.add_argument("--model", default=WHISPER_MODEL)
    parser.add_argument("--language", default=WHISPER_LANGUAGE)
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="auto", compute_type="int8")
    segments, _ = model.transcribe(
        args.input_media,
        word_timestamps=False,
        vad_filter=True,
        language=args.language,
    )

    entries = 0
    lines = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        entries += 1
        lines.append(str(entries))
        lines.append(f"{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}")
        lines.append(text)
        lines.append("")

    Path(args.output_srt).write_text("\n".join(lines), encoding="utf-8")
    print(f"[whisper_srt] ghi {entries} dòng phụ đề -> {args.output_srt}")


if __name__ == "__main__":
    main()
