"""Assemble the Cloudflare Pages deploy directory.

Local deploys were doing this by hand with a pile of Copy-Item calls, which is
exactly the kind of thing that silently drifts. Doing it in one script means CI
and a local `wrangler pages deploy` publish identical bytes.

Only what needs serving is copied: the site itself, the two data files, and the
Pages Function. Build tooling stays out of the bundle.
"""
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_deploy"

# path in repo -> path inside the deploy dir
INCLUDE = [
    ("index.html", "index.html"),
    ("README.md", "README.md"),
    ("robots.txt", "robots.txt"),
    ("sitemap.xml", "sitemap.xml"),
    ("llms.txt", "llms.txt"),
    ("_headers", "_headers"),
    (".nojekyll", ".nojekyll"),
    ("wrangler.toml", "wrangler.toml"),
]
INCLUDE_GLOBS = [
    ("assets", "*.js"),
    ("assets", "*.css"),
    ("assets/documents", "*.pdf"),
    ("assets/vendor/pdfjs", "*.mjs"),
    ("assets/vendor/pdfjs", "LICENSE"),
    ("data", "*.json"),
    ("functions", "*.js"),
]

# Both hosts send `cache-control: max-age=600` for everything, so after a deploy
# a browser can keep running the previous JS for ten minutes. Versioning the URLs
# fixes it: index.html itself is only cached briefly, but a changed asset gets a
# new name, so nobody executes stale code. Unchanged assets keep their URL and
# stay in cache.
CACHE_BUST = re.compile(rb'((?:href|src)=")((?:assets|data)/[^"?]+)(\?[^"]*)?(")')


def asset_version(assets: list[Path]) -> str:
    """Short hash over the *content* of every deployable asset.

    Content, not mtime: a fresh clone (every CI run) gives identical bytes and
    must produce the same version, otherwise the cache busts on every build for
    no reason.
    """
    h = hashlib.sha256()
    for p in sorted(assets):
        h.update(p.as_posix().encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:8]

REQUIRED = [
    "index.html",
    "robots.txt",
    "sitemap.xml",
    "llms.txt",
    "_headers",
    "assets/app.css",
    "assets/app.js",
    "assets/data.js",
    "assets/ui.js",
    "assets/palette.js",
    "assets/views-explore.js",
    "assets/views-pages.js",
    "assets/pdf-viewer.js",
    "assets/documents/HowToLiveBetter.pdf",
    "assets/vendor/pdfjs/pdf.mjs",
    "assets/vendor/pdfjs/pdf.worker.mjs",
    "data/book.json",
    "data/detail.json",
    "functions/_middleware.js",
]


def main() -> int:
    args = sys.argv[1:]
    # GitHub Pages publishes the repo as-is, so it never sees the generated
    # _deploy/index.html -- only Cloudflare would get the version stamp. With
    # --stamp-root the stamped HTML is written back to index.html in the repo
    # so both hosts serve versioned asset URLs. Keep it in the same commit as
    # the asset change and the two stay in step.
    stamp_root = "--stamp-root" in args

    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    if missing:
        print("missing from repo, cannot deploy:", file=sys.stderr)
        for m in missing:
            print("  " + m, file=sys.stderr)
        return 1

    if OUT.exists():
        shutil.rmtree(OUT)

    copied = 0
    for src, dst in INCLUDE:
        s = ROOT / src
        if not s.exists():          # .nojekyll / robots.txt are easy to lose
            continue
        target = OUT / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(s, target)
        copied += 1

    assets: list[Path] = []
    for folder, pattern in INCLUDE_GLOBS:
        for s in sorted((ROOT / folder).glob(pattern)):
            target = OUT / folder / s.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, target)
            assets.append(s)
            copied += 1

    version = asset_version(assets)
    index = OUT / "index.html"
    html = index.read_bytes()

    def stamp(raw: bytes) -> bytes:
        out, n = CACHE_BUST.subn(rb'\1\2?v=' + version.encode() + rb'\4', raw)
        if n == 0:
            print("warning: no asset URLs found in index.html to version", file=sys.stderr)
        return out

    index.write_bytes(stamp(html))

    if stamp_root:
        root_index = ROOT / "index.html"
        stamped = stamp(root_index.read_bytes())
        # don't rewrite the file if nothing changed, or every build dirties git
        if stamped != root_index.read_bytes():
            root_index.write_bytes(stamped)
            print(f"stamped repo index.html -> v{version} (commit this with the asset change)")

    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"_deploy ready: {copied} files, {size / 1024:.0f} KB, assets versioned v{version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
