#!/usr/bin/env python3
"""
fetch_image.py — Tìm và tải 1 ảnh stock từ Pexels theo từ khoá.

Dùng cho slide KHÔNG có screenshot/ảnh thật sẵn (vd ảnh minh hoạ concept chung
như "developer coding", "văn phòng"...). Với slide có UI/sản phẩm thật, ưu tiên
dùng screenshot thật (imageMode="screen") thay vì ảnh stock.

Usage:
    python scripts/fetch_image.py "developer coding laptop" out/my-project/workspace/hero.jpg

Env:
    PEXELS_API_KEY — bắt buộc, lấy tại pexels.com/api
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"


def search_and_download(query: str, out_path: Path, orientation: str = "portrait") -> dict:
    """Tìm ảnh khớp `query` trên Pexels, tải ảnh đầu tiên về out_path.
    Trả về metadata (photographer, url gốc) để ghi credit nếu cần."""
    import requests

    api_key = os.environ.get("PEXELS_API_KEY", "")
    if not api_key:
        raise RuntimeError("Thiếu PEXELS_API_KEY trong .env")

    r = requests.get(
        PEXELS_SEARCH_URL,
        headers={"Authorization": api_key},
        params={"query": query, "per_page": 5, "orientation": orientation},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    photos = data.get("photos") or []
    if not photos:
        raise RuntimeError(f"Không tìm thấy ảnh nào cho query: {query!r}")

    photo = photos[0]
    # "large2x" đủ nét cho video dọc 1080x1920 mà không quá nặng.
    img_url = photo["src"].get("large2x") or photo["src"]["original"]

    img_resp = requests.get(img_url, timeout=60)
    img_resp.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(img_resp.content)

    return {
        "photographer": photo.get("photographer", ""),
        "photographer_url": photo.get("photographer_url", ""),
        "pexels_url": photo.get("url", ""),
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: fetch_image.py <query> <output_path> [orientation]", file=sys.stderr)
        return 1

    query = sys.argv[1]
    out_path = Path(sys.argv[2])
    orientation = sys.argv[3] if len(sys.argv) > 3 else "portrait"

    meta = search_and_download(query, out_path, orientation)
    print(f"-> {out_path} (anh: {meta['photographer']} - {meta['pexels_url']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
