Optional font bundle for legacy tooling only.

The Markdown → PDF helper (`tools/md_to_pdf.py`) uses **Chromium print-to-PDF**
and system fonts (Segoe UI on Windows). It does not require a font file in this folder.

For **WeasyPrint** on Linux servers without good system fonts, install DejaVu or Liberation
fonts via the OS package manager, or set up `@font-face` in a fork of the print CSS.
