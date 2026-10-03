"""Assemble the Cloudflare Pages deploy directory.

Local deploys were doing this by hand with a pile of Copy-Item calls, which is
exactly the kind of thing that silently drifts. Doing it in one script means CI
and a local `wrangler pages deploy` publish identical bytes.

Only what needs serving is copied: the site itself, the two data files, and the
Pages Function. Build tooling stays out of the bundle.
"""
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

    for folder, pattern in INCLUDE_GLOBS:
        for s in sorted((ROOT / folder).glob(pattern)):
            target = OUT / folder / s.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, target)
            copied += 1

    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"_deploy ready: {copied} files, {size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())