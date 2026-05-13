#!/usr/bin/env python3
"""
Convert Markdown to PDF using the same layout engine as a browser (Chromium / Edge).

Pipeline: Markdown → HTML (tables, emphasis, TOC) → headless Chrome/Edge ``--print-to-pdf``
or optional **WeasyPrint** when no Chromium is available (typical on Linux servers).

Relative images in the .md are resolved from the source file's directory.

Install (minimal):
  pip install markdown

Optional (headless servers without Chrome):
  pip install weasyprint

Examples:
  python tools/md_to_pdf.py README.md
  python tools/md_to_pdf.py docs/guide.md -o build/guide.pdf
  python tools/md_to_pdf.py notes.md --title "My notes" --lang az --engine weasyprint
"""

from __future__ import annotations

import argparse
import html
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown
from markdown.extensions.toc import TocExtension

try:
    from markdown.extensions.toc import slugify_unicode
except ImportError:  # pragma: no cover
    from markdown.extensions.toc import slugify as slugify_unicode  # type: ignore[misc]


def _first_h1_title(md_text: str) -> str | None:
    for raw in md_text.splitlines():
        line = raw.strip()
        if not line.startswith("#"):
            continue
        if line.startswith("##"):
            continue
        return line[1:].lstrip()
    return None


def _chromium_candidates() -> list[Path]:
    paths: list[Path] = []
    for env in ("ERAFINANCE_CHROME_BIN", "GOOGLE_CHROME_BIN", "CHROME_PATH"):
        v = os.environ.get(env)
        if v:
            paths.append(Path(v).expanduser())
    pf = os.environ.get("PROGRAMFILES", r"C:\Program Files")
    pfx86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
    local = os.environ.get("LOCALAPPDATA", "")
    paths.extend(
        [
            Path(pf) / r"Google\Chrome\Application\chrome.exe",
            Path(pfx86) / r"Google\Chrome\Application\chrome.exe",
            Path(local) / r"Google\Chrome\Application\chrome.exe",
            Path(pf) / r"Microsoft\Edge\Application\msedge.exe",
            Path(pfx86) / r"Microsoft\Edge\Application\msedge.exe",
        ]
    )
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "microsoft-edge"):
        paths.append(Path("/usr/bin") / name)
        paths.append(Path("/usr/local/bin") / name)
    return [p for p in paths if p.is_file()]


def _find_chromium() -> Path | None:
    for p in _chromium_candidates():
        if p.is_file():
            return p.resolve()
    # PATH
    for name in ("chrome", "google-chrome", "chromium", "msedge", "microsoft-edge"):
        found = shutil.which(name)
        if found:
            return Path(found).resolve()
    return None


def _print_css() -> str:
    return """
@page { size: A4; margin: 14mm 12mm; }
html { font-size: 11pt; }
body {
  margin: 0;
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  color: #0f172a;
  line-height: 1.45;
}
h1 { font-size: 18pt; font-weight: 700; margin: 0.4em 0 0.35em; page-break-after: avoid; }
h2 { font-size: 14pt; font-weight: 650; margin: 0.85em 0 0.35em; page-break-after: avoid; }
h3 { font-size: 12pt; font-weight: 600; margin: 0.75em 0 0.3em; page-break-after: avoid; }
h4, h5, h6 { font-size: 11pt; font-weight: 600; margin: 0.65em 0 0.25em; page-break-after: avoid; }
p { margin: 0.45em 0; }
ul, ol { margin: 0.35em 0 0.5em; padding-left: 1.35em; }
li { margin: 0.2em 0; }
a { color: #1d4ed8; text-decoration: none; }
blockquote {
  margin: 0.6em 0;
  padding: 0.35em 0.75em;
  border-left: 3px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
}
hr { border: none; border-top: 1px solid #e2e8f0; margin: 1em 0; }
.toc {
  margin: 0 0 1.1em;
  padding: 0.65em 0.85em;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 10pt;
  page-break-after: avoid;
}
.toc > ul { margin: 0.25em 0 0; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.65em 0;
  font-size: 10pt;
  page-break-inside: auto;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; page-break-after: auto; }
th, td {
  border: 1px solid #cbd5e1;
  padding: 6px 8px;
  vertical-align: top;
  text-align: left;
}
th { background: #f1f5f9; font-weight: 600; }
pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 9pt;
  font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  page-break-inside: avoid;
}
code {
  font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
  font-size: 0.92em;
  background: #f1f5f9;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}
pre code { background: transparent; padding: 0; font-size: inherit; }
"""


def _md_to_html_body(md_text: str, *, toc_depth: str) -> tuple[str, str]:
    md = markdown.Markdown(
        extensions=[
            TocExtension(
                permalink=False,
                slugify=slugify_unicode,
                toc_depth=toc_depth,
            ),
            "markdown.extensions.tables",
            "markdown.extensions.fenced_code",
            "markdown.extensions.nl2br",
            "markdown.extensions.sane_lists",
        ],
    )
    inner = md.convert(md_text)
    return inner, md.toc or ""


def build_pdf_html_document(
    md_text: str,
    *,
    document_title: str,
    lang: str,
    toc_depth: str,
    include_toc: bool,
) -> str:
    inner, toc = _md_to_html_body(md_text, toc_depth=toc_depth)
    toc_block = ""
    if include_toc and toc.strip():
        toc_block = f'<div class="toc" role="navigation" aria-label="Contents">{toc}</div>'
    safe_lang = html.escape(lang, quote=True)
    safe_title = html.escape(document_title, quote=True)
    css = _print_css()
    return f"""<!DOCTYPE html>
<html lang="{safe_lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title}</title>
  <style>
{css}
  </style>
</head>
<body>
{toc_block}{inner}
</body>
</html>"""


def _write_temp_html(md_dir: Path, html_doc: str) -> Path:
    fd, path = tempfile.mkstemp(
        suffix=".html",
        prefix=".erafinance-pdf-",
        dir=str(md_dir.resolve()),
    )
    try:
        data = html_doc.encode("utf-8")
        os.write(fd, data)
    finally:
        os.close(fd)
    return Path(path)


def _pdf_via_chromium(html_file: Path, pdf_out: Path, browser: Path) -> None:
    pdf_out.parent.mkdir(parents=True, exist_ok=True)
    pdf_arg = str(pdf_out.resolve())
    uri = html_file.resolve().as_uri()
    base_cmd = [
        str(browser),
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_arg}",
        uri,
    ]
    last_err: subprocess.CalledProcessError | None = None
    for headless in ("--headless=new", "--headless"):
        cmd = [base_cmd[0], headless, *base_cmd[1:]]
        try:
            subprocess.run(
                cmd,
                check=True,
                timeout=180,
                capture_output=True,
                text=True,
            )
            return
        except subprocess.CalledProcessError as e:
            last_err = e
    if last_err is not None:
        raise RuntimeError(
            f"Chromium print-to-pdf failed ({browser}): exit {last_err.returncode}; "
            f"stderr={last_err.stderr!r}"
        ) from last_err
    raise RuntimeError(f"Chromium print-to-pdf failed ({browser}).")


def _pdf_via_weasyprint(html_doc: str, base_url: str, pdf_out: Path) -> None:
    try:
        from weasyprint import HTML
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "WeasyPrint is not installed. Run: pip install weasyprint "
            "(or install Google Chrome / Microsoft Edge for print-to-pdf)."
        ) from e
    pdf_out.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html_doc, base_url=base_url).write_pdf(str(pdf_out.resolve()))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert Markdown to PDF (Chromium print-to-PDF or WeasyPrint).",
    )
    parser.add_argument("input", type=Path, help="Path to the source .md file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output .pdf path (default: same basename as input, .pdf)",
    )
    parser.add_argument(
        "-t",
        "--title",
        default=None,
        help="PDF document title metadata (default: first # heading or filename stem)",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="HTML lang attribute (default: %(default)s)",
    )
    parser.add_argument(
        "--toc-depth",
        default="1-6",
        metavar="RANGE",
        help='TOC heading levels, e.g. "2-4" or "1-6" (default: %(default)s)',
    )
    parser.add_argument(
        "--no-inline-toc",
        action="store_true",
        help="Do not prepend auto-generated table of contents",
    )
    parser.add_argument(
        "--engine",
        choices=("auto", "chromium", "weasyprint"),
        default="auto",
        help='PDF backend: "chromium" (Chrome/Edge headless), "weasyprint", or "auto" (default: chromium if found, else weasyprint)',
    )
    parser.add_argument(
        "--browser",
        type=Path,
        default=None,
        help="Explicit path to chrome.exe / msedge.exe (overrides search and ERAFINANCE_CHROME_BIN)",
    )
    args = parser.parse_args()

    md_path = args.input.resolve()
    if not md_path.is_file():
        print(f"Not found: {md_path}", file=sys.stderr)
        return 1

    md_text = md_path.read_text(encoding="utf-8")
    title = (
        args.title
        or _first_h1_title(md_text)
        or md_path.stem.replace("-", " ").replace("_", " ")
    )
    out_path = (args.output or md_path.with_suffix(".pdf")).resolve()
    base_dir = md_path.parent

    html_doc = build_pdf_html_document(
        md_text,
        document_title=title,
        lang=args.lang,
        toc_depth=args.toc_depth,
        include_toc=not args.no_inline_toc,
    )
    base_url = base_dir.resolve().as_uri() + "/"

    browser = args.browser.resolve() if args.browser else None
    if browser and not browser.is_file():
        print(f"Browser not found: {browser}", file=sys.stderr)
        return 1

    engine = args.engine
    if engine == "auto":
        if browser or _find_chromium():
            engine = "chromium"
        else:
            engine = "weasyprint"

    tmp_html: Path | None = None
    try:
        if engine == "chromium":
            exe = browser or _find_chromium()
            if not exe:
                print(
                    "No Chromium-based browser found (Chrome / Edge). "
                    "Install one, set ERAFINANCE_CHROME_BIN, pass --browser, "
                    "or use: pip install weasyprint && python tools/md_to_pdf.py ... --engine weasyprint",
                    file=sys.stderr,
                )
                return 1
            tmp_html = _write_temp_html(base_dir, html_doc)
            _pdf_via_chromium(tmp_html, out_path, exe)
        else:
            _pdf_via_weasyprint(html_doc, base_url, out_path)
    except (OSError, RuntimeError, subprocess.SubprocessError) as e:
        print(f"PDF build failed: {e}", file=sys.stderr)
        return 1
    finally:
        if tmp_html is not None:
            try:
                tmp_html.unlink(missing_ok=True)
            except OSError:
                pass

    print(f"OK: {out_path} ({engine})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
