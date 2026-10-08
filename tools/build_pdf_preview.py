"""Split the source PDF into small same-origin chunks for reliable web preview."""
from pathlib import Path
import math

import pymupdf


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "documents" / "HowToLiveBetter.pdf"
OUT_DIR = SOURCE.parent
CHUNK_PAGES = 20


def main() -> int:
    source = pymupdf.open(SOURCE)
    total_pages = len(source)
    chunk_count = math.ceil(total_pages / CHUNK_PAGES)

    for stale in OUT_DIR.glob("preview-*.pdf"):
        stale.unlink()

    total_bytes = 0
    for chunk_index in range(chunk_count):
        first = chunk_index * CHUNK_PAGES
        last = min(first + CHUNK_PAGES, total_pages) - 1
        chunk = pymupdf.open()
        chunk.insert_pdf(source, from_page=first, to_page=last)
        target = OUT_DIR / f"preview-{chunk_index + 1:03d}.pdf"
        chunk.save(target, garbage=4, deflate=True, clean=True)
        total_bytes += target.stat().st_size
        chunk.close()

    source.close()
    print(
        f"PDF preview ready: {chunk_count} chunks, {total_pages} pages, "
        f"{total_bytes / 1024 / 1024:.1f} MB total"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
