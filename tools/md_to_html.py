#!/usr/bin/env python3
"""
Convert any Markdown file to a single self-contained HTML page (embedded CSS).

Optional sidebar is built from document headings (Python-Markdown TOC extension).
If the source contains a literal ``[toc]`` marker (case-insensitive), it is replaced
with the same table of contents inside the body.

Dependency:
  pip install markdown

Examples:
  python md_to_html.py README.md
  python md_to_html.py docs/guide.md -o build/guide.html
  python md_to_html.py notes.md --title "My notes" --lang en --toc-depth 2-4
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

import markdown
from markdown.extensions.toc import TocExtension

try:
    from markdown.extensions.toc import slugify_unicode
except ImportError:  # pragma: no cover - very old markdown
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


def _first_h1_anchor(inner_html: str) -> tuple[str, str]:
    """If first <h1> has no id, add id=\"document-top\"; return (html, anchor for \"back to top\")."""
    m = re.search(r"<h1\b[^>]*\bid=\"([^\"]+)\"", inner_html, re.IGNORECASE)
    if m:
        return inner_html, m.group(1)
    m2 = re.search(r"<h1(\b[^>]*)>", inner_html, re.IGNORECASE)
    if m2:
        patched = re.sub(
            r"<h1(\b[^>]*)>",
            '<h1 id="document-top"\\1>',
            inner_html,
            count=1,
            flags=re.IGNORECASE,
        )
        return patched, "document-top"
    return inner_html, "main-content"


def _sidebar_toc_html(toc_inner: str, top_anchor: str) -> str:
    if not toc_inner.strip():
        return ""
    return f"""
<aside class="toc-sidebar" aria-label="Table of contents">
  <div class="toc-sidebar-inner">
    <p class="toc-sidebar-title">Contents</p>
    <nav class="toc-sidebar-nav">
{toc_inner}
    </nav>
    <p class="toc-sidebar-foot">
      <a href="#{html.escape(top_anchor, quote=True)}">Top of document ↑</a>
    </p>
  </div>
</aside>
"""


def _document_css() -> str:
    return """
:root {
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e2e8f0;
  --accent: #1d4ed8;
  --accent-soft: #eff6ff;
  --sidebar-w: 280px;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.55;
  color: var(--text);
  background: var(--bg);
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--accent);
  color: #fff;
  padding: 8px 16px;
  z-index: 100;
}
.skip-link:focus { left: 8px; top: 8px; }

.doc-header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 40;
  box-shadow: 0 1px 0 rgba(15,23,42,.04);
}
.doc-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.doc-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 650;
}
.doc-header-meta { font-size: 0.85rem; color: var(--muted); }

.doc-layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  gap: 2rem;
  align-items: start;
}
.doc-layout--single {
  grid-template-columns: 1fr;
}

.toc-sidebar {
  position: sticky;
  top: 5.5rem;
  max-height: calc(100vh - 6rem);
  overflow: auto;
}
.toc-sidebar-inner {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1rem 0.75rem;
  font-size: 0.875rem;
}
.toc-sidebar-title {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.toc-sidebar-nav .toc {
  margin: 0;
  padding: 0;
}
.toc-sidebar-nav .toc > ul {
  margin: 0;
  padding-left: 1.15rem;
}
.toc-sidebar-nav ul ul { margin-top: 0.25em; }
.toc-sidebar-nav li { margin: 0.35em 0; }
.toc-sidebar-nav a { display: inline; line-height: 1.35; }
.toc-sidebar-foot {
  margin: 0.75rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
}

.doc-main {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem 2.25rem 3rem;
  min-width: 0;
}

/* Markdown body */
.doc-main h1 { font-size: 1.75rem; margin-top: 0; scroll-margin-top: 5rem; }
.doc-main h2 {
  font-size: 1.2rem;
  margin-top: 2rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
  scroll-margin-top: 5rem;
}
.doc-main h3 { font-size: 1.05rem; margin-top: 1.25rem; scroll-margin-top: 5rem; }
.doc-main p { margin: 0.75em 0; }
.doc-main ul, .doc-main ol { margin: 0.5em 0; padding-left: 1.5rem; }
.doc-main li { margin: 0.25em 0; }

/* Inline [toc] in document */
.doc-main div.toc {
  background: var(--accent-soft);
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 1rem 1rem 1rem 1.25rem;
  margin: 1rem 0 1.5rem;
}
.doc-main div.toc ul { margin: 0.25em 0; }
.doc-main div.toc a { font-weight: 500; }

.doc-main blockquote {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--accent);
  background: #f1f5f9;
  color: #334155;
}
.doc-main code {
  font-size: 0.9em;
  background: #f1f5f9;
  padding: 0.12em 0.35em;
  border-radius: 4px;
}
.doc-main pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.85rem;
}
.doc-main pre code { background: none; padding: 0; color: inherit; }
.doc-main table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin: 1rem 0;
}
.doc-main th, .doc-main td {
  border: 1px solid var(--border);
  padding: 0.5rem 0.65rem;
  text-align: left;
  vertical-align: top;
}
.doc-main th { background: #f1f5f9; font-weight: 600; }
.doc-main img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin: 0.75rem 0;
}

[id] { scroll-margin-top: 5.5rem; }

@media (max-width: 900px) {
  .doc-layout {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
  .toc-sidebar {
    position: relative;
    top: auto;
    max-height: none;
    order: -1;
  }
}
"""


def _md_to_inner_html(md_text: str, *, toc_depth: str) -> tuple[str, str]:
    """Return (inner_html, toc_html_fragment)."""
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
    toc = md.toc or ""
    return inner, toc


def build_html(
    md_text: str,
    *,
    page_title: str,
    lang: str,
    subtitle: str,
    toc_depth: str,
) -> str:
    inner, toc = _md_to_inner_html(md_text, toc_depth=toc_depth)
    inner, top_id = _first_h1_anchor(inner)
    css = _document_css()
    sidebar = _sidebar_toc_html(toc, top_id)
    layout_class = "doc-layout doc-layout--single" if not sidebar.strip() else "doc-layout"
    safe_title = html.escape(page_title, quote=True)
    safe_sub = html.escape(subtitle, quote=True)
    safe_lang = html.escape(lang, quote=True)
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
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="doc-header">
    <div class="doc-header-inner">
      <h1><a href="#{html.escape(top_id, quote=True)}" style="color:inherit">{safe_title}</a></h1>
      <span class="doc-header-meta">{safe_sub}</span>
    </div>
  </header>

  <div class="{layout_class}">
    {sidebar}
    <article id="main-content" class="doc-main">
{inner}
    </article>
  </div>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert a Markdown file to a standalone HTML page.",
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Path to the source .md file",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output .html path (default: same basename as input, .html)",
    )
    parser.add_argument(
        "-t",
        "--title",
        default=None,
        help="HTML <title> and header (default: first # heading, else input file stem)",
    )
    parser.add_argument(
        "--subtitle",
        default="Markdown → HTML",
        help="Short line shown in the sticky header (default: %(default)s)",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help='Value for <html lang="..."> (default: %(default)s)',
    )
    parser.add_argument(
        "--toc-depth",
        default="1-6",
        metavar="RANGE",
        help='Heading levels in the sidebar TOC, e.g. "2-4" or "1-6" (default: %(default)s)',
    )
    args = parser.parse_args()
    md_path = args.input.resolve()
    if not md_path.is_file():
        print(f"Not found: {md_path}", file=sys.stderr)
        return 1

    md_text = md_path.read_text(encoding="utf-8")
    title = args.title or _first_h1_title(md_text) or md_path.stem.replace("-", " ").replace("_", " ")
    out = (args.output or md_path.with_suffix(".html")).resolve()

    html_out = build_html(
        md_text,
        page_title=title,
        lang=args.lang,
        subtitle=args.subtitle,
        toc_depth=args.toc_depth,
    )
    out.write_text(html_out, encoding="utf-8")
    print(f"OK: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
