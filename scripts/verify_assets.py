#!/usr/bin/env python3
"""Verify that HTML and JS asset references resolve inside the repository."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


REPO = Path(__file__).resolve().parents[1]
DIST_INDEX = REPO / "dist" / "index.html"
HTML_ASSET_RE = re.compile(r"""(?:src|href)=["'](?:\./)?(assets/[^"']+)["']""")
JS_IMPORT_RE = re.compile(r"""(?:from|import\()\s*["'`](\./[^"'`]+)["'`]""")


def clean_ref(ref: str) -> str:
    parsed = urlsplit(ref)
    return parsed.path


def add_ref(queue: list[Path], seen: set[Path], path: Path) -> None:
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO)
    except ValueError:
        print(f"  OUTSIDE {path}")
        seen.add(resolved)
        return
    if resolved not in seen:
        seen.add(resolved)
        queue.append(resolved)


def get_index_html_files() -> list[Path]:
    if DIST_INDEX.is_file():
        return [DIST_INDEX]
    return [REPO / "index.html"]


def collect_refs(index_file: Path, queue: list[Path], seen: set[Path]) -> None:
    for ref in HTML_ASSET_RE.findall(index_file.read_text()):
        add_ref(queue, seen, index_file.parent / clean_ref(ref))


def main() -> int:
    missing = False
    queue: list[Path] = []
    seen: set[Path] = set()
    for index_file in get_index_html_files():
        collect_refs(index_file, queue, seen)

    checked: list[Path] = []
    while queue:
        path = queue.pop(0)
        checked.append(path)
        if not path.exists():
            print(f"  MISSING {path.relative_to(REPO)}")
            missing = True
            continue
        print(f"  OK {path.relative_to(REPO)}")
        if path.suffix == ".js":
            text = path.read_text(errors="ignore")
            for ref in JS_IMPORT_RE.findall(text):
                if ref.startswith("./"):
                    add_ref(queue, seen, path.parent / clean_ref(ref))

    if not checked:
        print("  No asset references found")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
