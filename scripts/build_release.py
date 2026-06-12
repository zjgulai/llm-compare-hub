#!/usr/bin/env python3
"""Build a clean static release artifact for public deployment."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from verify_assets import JS_IMPORT_RE, HTML_ASSET_RE, clean_ref


REPO = Path(__file__).resolve().parents[1]
RELEASE = REPO / "release"

PUBLIC_FILES = [
    "index.html",
    "favicon.svg",
    "robots.txt",
    "sitemap.xml",
    "api-data.json",
    "siliconflow-data.json",
    "compare-data.json",
    "free-models-data.json",
    "bai-data.json",
    "easyrouter-data.json",
    "claude-data.json",
    "codex-data.json",
    "claude.html",
    "codex.html",
    "claude/index.html",
    "codex/index.html",
]

FORBIDDEN_PARTS = {
    ".git",
    ".github",
    ".sisyphus",
    ".playwright-mcp",
    ".essence-cache",
    "src",
    "scripts",
    "pages",
    "node_modules",
}

FORBIDDEN_NAMES = {
    "README.md",
    "AUDIT.md",
    "CHANGELOG.md",
    "Makefile",
    ".DS_Store",
    ".gitignore",
}


def copy_file(rel: str) -> None:
    src = REPO / rel
    if not src.is_file():
        raise FileNotFoundError(rel)
    dst = RELEASE / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def collect_assets() -> list[str]:
    queue: list[Path] = []
    seen: set[Path] = set()

    def add(path: Path) -> None:
        resolved = path.resolve()
        try:
            resolved.relative_to(REPO)
        except ValueError as exc:
            raise RuntimeError(f"asset reference escapes repo: {path}") from exc
        if resolved not in seen:
            seen.add(resolved)
            queue.append(resolved)

    for ref in HTML_ASSET_RE.findall((REPO / "index.html").read_text()):
        add(REPO / clean_ref(ref))

    ordered: list[str] = []
    while queue:
        path = queue.pop(0)
        if not path.exists():
            raise FileNotFoundError(path.relative_to(REPO))
        ordered.append(str(path.relative_to(REPO)))
        if path.suffix == ".js":
            for ref in JS_IMPORT_RE.findall(path.read_text(errors="ignore")):
                if ref.startswith("./"):
                    add(path.parent / clean_ref(ref))
    return ordered


def assert_clean_release() -> None:
    bad: list[str] = []
    for path in RELEASE.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(RELEASE)
        parts = set(rel.parts)
        if parts & FORBIDDEN_PARTS or rel.name in FORBIDDEN_NAMES:
            bad.append(str(rel))
    if bad:
        raise RuntimeError("forbidden files in release: " + ", ".join(sorted(bad)))


def main() -> int:
    if RELEASE.exists():
        shutil.rmtree(RELEASE)
    RELEASE.mkdir()

    for rel in PUBLIC_FILES:
        copy_file(rel)
    for rel in collect_assets():
        copy_file(rel)

    assert_clean_release()
    files = sorted(str(p.relative_to(RELEASE)) for p in RELEASE.rglob("*") if p.is_file())
    for rel in files:
        print(f"  {rel}")
    print(f"release files: {len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
