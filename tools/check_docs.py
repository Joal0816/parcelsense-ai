#!/usr/bin/env python3
"""Check relative file targets in Markdown links without network access."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"!?\[[^\]]*\]\(([^)]*)\)")


def markdown_files() -> list[Path]:
    return sorted(path for path in ROOT.rglob("*.md")
                  if not any(part in {".git", "node_modules", ".pio", "dist"}
                             for part in path.relative_to(ROOT).parts))


def visible_lines(path: Path) -> list[str]:
    lines: list[str] = []
    fence: str | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.lstrip()
        marker = stripped[:3]
        if marker in {"```", "~~~"}:
            if fence is None:
                fence = marker
            elif marker == fence:
                fence = None
            continue
        if fence is None:
            lines.append(line)
    return lines


def target_text(raw: str) -> str:
    value = raw.strip()
    if value.startswith("<"):
        end = value.find(">")
        return value[1:end] if end >= 0 else value
    return value.split(maxsplit=1)[0] if value else ""


def main() -> int:
    failures: list[str] = []
    checked = 0
    for source in markdown_files():
        for line_number, line in enumerate(visible_lines(source), start=1):
            for match in LINK.finditer(line):
                target = target_text(match.group(1))
                parsed = urlsplit(target)
                if not target or parsed.scheme or target.startswith("//") or not parsed.path:
                    continue
                checked += 1
                destination = (source.parent / unquote(parsed.path)).resolve()
                if not destination.is_file() and not destination.is_dir():
                    failures.append(
                        f"{source.relative_to(ROOT)}:{line_number}: missing local link target {parsed.path!r}"
                    )

    if failures:
        print("Broken local Markdown links:", file=sys.stderr)
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"PASS: {checked} local Markdown file links resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
