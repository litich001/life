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
    (".nojekyll", ".nojekyll"),
    ("wrangler.toml", "wrangler.toml"),
]
INCLUDE_GLOBS = [
    ("assets", "*.js"),
    ("assets", "*.css"),
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
    """Short hash over every deployable asset, so any change busts the cache."""
    h = hashlib.sha256()
    for p in sorted(assets):
        h.update(p.name.encode())
        h.update(str(p.stat().st_mtime_ns).encode())
    return h.hexdigest()[:8]

REQUIRED = [
    "index.html",
    "assets/app.css",
    "assets/app.js",
    "assets/data.js",
    "assets/ui.js",
    "assets/palette.js",
    "assets/views-explore.js",
    "assets/views-pages.js",
    "data/book.json",
    "data/detail.json",
    "functions/_middleware.js",
]


def main() -> int:
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
    stamped, n = CACHE_BUST.subn(rb'\1\2?v=' + version.encode() + rb'\4', html)
    if n == 0:
        print("warning: no asset URLs found in index.html to version", file=sys.stderr)
    index.write_bytes(stamped)

    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"_deploy ready: {copied} files, {size / 1024:.0f} KB, assets versioned v{version} ({n} refs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())