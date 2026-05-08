#!/usr/bin/env python3
"""
Convert tables from a PDF file into a single Markdown (.md) document.

Why pdfplumber:
  - Pure Python (no Java like tabula, no Ghostscript like camelot).
  - Reasonable table detection out of the box and a simple Page.extract_tables().

Install:
  python -m pip install -r scripts/requirements-pdf-table-to-md.txt

Usage (from repo root):
  python scripts/pdf_table_to_md.py --input path/to/file.pdf
  python scripts/pdf_table_to_md.py -i in.pdf -o out.md --pages 1,3-5 --first-row-header

CLI flags:
  -i / --input             Path to the source PDF (required).
  -o / --output            Path to the output .md (default: <input>.md next to PDF).
  --pages                  Page selection: "1,3-5" (1-based). Default: all pages.
  --first-row-header       Treat each table's first row as the Markdown header.
                           Otherwise a synthetic header `Col 1 | Col 2 | …` is written
                           and the first row is kept as a data row.
  --min-rows               Skip tables that contain fewer than N rows (default: 2).
  --title                  Optional H1 title to put at the top of the .md file.
  --quiet                  Suppress progress messages.

Exit codes:
  0 — success (at least one table was written).
  1 — argparse / file-not-found / invalid args.
  2 — PDF parsed successfully, but no tables matched the filters.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

try:
    import pdfplumber  # type: ignore[import-untyped]
except ImportError as exc:  # pragma: no cover - import guard
    sys.stderr.write(
        "pdfplumber is not installed. Run:\n"
        "    python -m pip install -r scripts/requirements-pdf-table-to-md.txt\n"
    )
    raise SystemExit(1) from exc


# ---------- argparse ---------------------------------------------------------


def _parse_pages_arg(raw: str | None) -> set[int] | None:
    """Parse "1,3-5" → {1, 3, 4, 5}. None → all pages."""
    if not raw:
        return None
    pages: set[int] = set()
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            lo_str, hi_str = chunk.split("-", 1)
            lo, hi = int(lo_str), int(hi_str)
            if lo <= 0 or hi < lo:
                raise argparse.ArgumentTypeError(f"Invalid page range: {chunk!r}")
            pages.update(range(lo, hi + 1))
        else:
            n = int(chunk)
            if n <= 0:
                raise argparse.ArgumentTypeError(f"Pages are 1-based: {chunk!r}")
            pages.add(n)
    return pages


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Convert tables from a PDF file into a Markdown (.md) file.",
    )
    p.add_argument("-i", "--input", required=True, type=Path, help="Path to the source PDF.")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Path to the output .md (default: <input>.md next to PDF).",
    )
    p.add_argument(
        "--pages",
        type=str,
        default=None,
        help="Page selection: '1,3-5' (1-based). Default: all pages.",
    )
    p.add_argument(
        "--first-row-header",
        action="store_true",
        help="Treat each table's first row as the Markdown header.",
    )
    p.add_argument(
        "--min-rows",
        type=int,
        default=2,
        help="Skip tables with fewer than N rows (default: 2).",
    )
    p.add_argument(
        "--title",
        type=str,
        default=None,
        help="Optional H1 title to put at the top of the .md file.",
    )
    p.add_argument("--quiet", action="store_true", help="Suppress progress messages.")
    return p.parse_args(argv)


# ---------- core conversion --------------------------------------------------


@dataclass(frozen=True)
class ExtractedTable:
    page_number: int  # 1-based
    table_index: int  # 1-based within the page
    rows: tuple[tuple[str, ...], ...]


def _normalize_cell(value: object) -> str:
    """
    Normalize a single cell:
      - None → "".
      - Collapse whitespace runs to a single space.
      - Replace embedded newlines with "<br>" (rendered correctly by GFM).
      - Escape pipe characters so they don't break Markdown table syntax.
      - Trim leading/trailing whitespace.
    """
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    parts = [
        " ".join(line.split())
        for line in text.split("\n")
        if line is not None
    ]
    parts = [p for p in parts if p != ""]
    joined = "<br>".join(parts)
    return joined.replace("|", r"\|")


def _normalize_row(row: Iterable[object]) -> tuple[str, ...]:
    return tuple(_normalize_cell(c) for c in row)


def _pad_rows(rows: Sequence[Sequence[str]]) -> list[list[str]]:
    """Equalize column counts across all rows by padding with empty strings."""
    width = max((len(r) for r in rows), default=0)
    return [[*r, *([""] * (width - len(r)))] for r in rows]


def _table_to_markdown(
    table: ExtractedTable,
    *,
    first_row_header: bool,
) -> str:
    rows = _pad_rows(table.rows)
    if not rows:
        return ""

    if first_row_header:
        header, body = rows[0], rows[1:]
    else:
        header = [f"Col {i + 1}" for i in range(len(rows[0]))]
        body = rows

    lines: list[str] = []
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for row in body:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def extract_tables(pdf_path: Path, pages: set[int] | None) -> list[ExtractedTable]:
    """Extract all tables (or those on requested pages) from `pdf_path`."""
    out: list[ExtractedTable] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            if pages is not None and page_index not in pages:
                continue
            raw_tables = page.extract_tables() or []
            for table_index, raw in enumerate(raw_tables, start=1):
                normalized = tuple(_normalize_row(r) for r in raw if r is not None)
                if not normalized:
                    continue
                out.append(
                    ExtractedTable(
                        page_number=page_index,
                        table_index=table_index,
                        rows=normalized,
                    )
                )
    return out


def render_markdown(
    tables: Sequence[ExtractedTable],
    *,
    first_row_header: bool,
    title: str | None,
    source: Path,
) -> str:
    parts: list[str] = []
    if title:
        parts.append(f"# {title}\n")
    parts.append(f"_Source PDF:_ `{source.name}`  ")
    parts.append(f"_Tables extracted:_ **{len(tables)}**\n")

    for t in tables:
        parts.append(f"\n## Page {t.page_number} — Table {t.table_index}\n")
        parts.append(_table_to_markdown(t, first_row_header=first_row_header))
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


# ---------- main -------------------------------------------------------------


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    pdf_path: Path = args.input.resolve()
    if not pdf_path.is_file():
        sys.stderr.write(f"Input PDF not found: {pdf_path}\n")
        return 1

    output: Path = (args.output or pdf_path.with_suffix(".md")).resolve()
    pages = _parse_pages_arg(args.pages)

    if not args.quiet:
        page_hint = "all" if pages is None else ",".join(str(p) for p in sorted(pages))
        print(f"[pdf-table-to-md] reading {pdf_path} (pages: {page_hint})")

    all_tables = extract_tables(pdf_path, pages)
    kept = [t for t in all_tables if len(t.rows) >= args.min_rows]

    if not args.quiet:
        skipped = len(all_tables) - len(kept)
        print(
            f"[pdf-table-to-md] found {len(all_tables)} table(s); "
            f"kept {len(kept)} (>= {args.min_rows} rows), skipped {skipped}"
        )

    if not kept:
        sys.stderr.write("No tables matched the filters; nothing to write.\n")
        return 2

    md = render_markdown(
        kept,
        first_row_header=args.first_row_header,
        title=args.title,
        source=pdf_path,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(md, encoding="utf-8")

    if not args.quiet:
        print(f"[pdf-table-to-md] wrote {output} ({len(kept)} table(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
