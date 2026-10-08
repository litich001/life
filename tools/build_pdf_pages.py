"""Render the source PDF into lazy-loadable web pages.

The site intentionally uses page images for the inline reader, matching the
production resume implementation on lizhe.work. The original PDF remains
available beside it for search, download, and native-reader use.
"""
from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pymupdf
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "documents" / "HowToLiveBetter.pdf"
OUT = ROOT / "assets" / "documents" / "pages"
SCALE = 1.35

_document: pymupdf.Document | None = None


def init_worker() -> None:
    global _document
    _document = pymupdf.open(SOURCE)


def render_page(index: int) -> tuple[int, int]:
    assert _document is not None
    page = _document[index]
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    target = OUT / f"page-{index + 1:03}.webp"
    image.save(target, "WEBP", quality=72, method=4)
    return index + 1, target.stat().st_size


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(SOURCE) as document:
        page_count = document.page_count

    expected = {f"page-{number:03}.webp" for number in range(1, page_count + 1)}
    for old in OUT.glob("page-*.webp"):
        if old.name not in expected:
            old.unlink()

    workers = min(8, os.cpu_count() or 4)
    with ProcessPoolExecutor(max_workers=workers, initializer=init_worker) as pool:
        results = list(pool.map(render_page, range(page_count), chunksize=4))

    total = sum(size for _, size in results)
    print(f"rendered {page_count} pages to {OUT} ({total / 1024 / 1024:.1f} MiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
