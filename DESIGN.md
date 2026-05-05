# DESIGN.md — DayDay ERP (Management)

**Final single source of truth** for all DayDay ERP UI (web `apps/web` and aligned surfaces). Any layout or styling task should be implementable from this file alone. **Reference implementation:** the cash **«Avans hesabatı»** advance-report draft modal (`banking.cash.btnAdvanceTop`) — modal shell, spacing, fields, and footer actions without a separator strip.

Code tokens: `apps/web/lib/design-system.ts`, `apps/web/lib/form-styles.ts`, `apps/web/lib/form-classes.ts`. New and refactored screens **must** match this document; divergent legacy UI is **debt to remove**, not an alternate standard.

---

## Corner radius — modern SaaS (tokens in `apps/web/lib/design-system.ts`)

Use **Tailwind scale radii** for a softer, contemporary shell. **Do not** default to near-square **`rounded-[2px]`** on outer chrome, fields, or buttons.

| Category | Standard | Notes |
|----------|----------|--------|
| **Outer shells** | **`rounded-2xl`** | Modal panels (`role="dialog"` roots, `MODAL_DIALOG_CONTENT_CLASS`), **cards**, **panels**, **dropzones**, **table viewports** (`DATA_TABLE_VIEWPORT_CLASS`). Use **`rounded-xl`** only if `2xl` clips content or breaks a tight layout. |
| **Form controls** | **`rounded-lg`** | **`Input`**, **`<select>`**, **`Select`**, **`Textarea`**, **`DatePicker`** surface, **combobox** triggers, **checkbox** frames — align with tokens (`MODAL_INPUT_CLASS`, `FORM_INPUT_CLASS`, etc.). Use **`rounded-md`** only for documented density exceptions. |
| **Buttons** | **`rounded-lg`** | Primary, outline, ghost, toolbar, modal footer, table row icon hit targets — same family as fields (`PRIMARY_BUTTON_CLASS`, `SECONDARY_BUTTON_CLASS`, `TABLE_ROW_ICON_BTN_CLASS`, `MODAL_FOOTER_BUTTON_CLASS`). **`rounded-md`** allowed if matched to paired inputs in the same row. |

**Graphic exceptions:** non-interactive **status dots** or **avatars** may use **`rounded-full`**. **Pills / micro-badges** may use **`rounded-md`**–**`rounded-lg`**; avoid arbitrary one-off radii unless TZ documents them.

---

## Color palette

- **Primary**: #34495E (Slate Blue) — long-session UI text and titles.
- **Secondary**: #7F8C8D (Asbestos) — secondary text, modal close icon.
- **Background**: #EBEDF0 (System gray) — app shell background.
- **Action**: #2980B9 (Strong Blue) — primary actions, focus rings on controls.
- **Border (muted)**: #D5DADF — cards, fields, dividers on `#EBEDF0` (avoid low-contrast `slate-100`-only borders).

---

## Form elements & inputs

Applies to all single-line and multi-line **data entry** controls unless TZ states otherwise.

- **Radius:** **`rounded-lg`** (see § Corner radius).
- **Border:** **`border` `border-[#D5DADF]`** at rest.
- **Focus:** **`focus:outline-none`** + **`focus:ring-1`** + **`focus:ring-[#2980B9]`**.
- **Height (single-line):** **`h-9`**, **`min-h-9`**, **`box-border`**.
- **Typography:** values and placeholders **`text-[13px]`**; placeholder color **`#7F8C8D`**.
- **Background:** **`bg-white`**; disabled: muted fill per tokens (e.g. `#F4F5F7`).

**Multiline** (`Textarea`): same radius, border, and focus; height follows content (`min-h` per token), not forced `h-9`.

---

## Buttons (global)

- **Radius:** **`rounded-lg`** for every button (see § Corner radius).
- **Label size:** **`text-[13px]`** on button labels unless TZ requires a one-off (e.g. legal microcopy).
- **Heights:** Toolbar / dense toolbar actions **`h-8`** (`PRIMARY_BUTTON_CLASS` / `SECONDARY_BUTTON_CLASS` in design-system). **Modal footers** and **form-aligned** primary/cancel pairs **`h-9`** with **`text-[13px]`** — same vertical rhythm as fields.
- **Primary:** fill **`#2980B9`**, hover per token sheet.
- **Outline / cancel:** white fill, border **`#D5DADF`**, **`variant="outline"`** where using the shared `Button` component.

---

## Modal & dialog standards

Applies to **`role="dialog"`**, Radix **`Dialog`**, and full-viewport overlays that behave as modals.

### Shell

- **Outer panel:** **`rounded-2xl`** border **`#D5DADF`**, white background (see § Corner radius; **`rounded-xl`** if layout requires).

### Header

- **Left:** Title (`DialogTitle` or equivalent) — **`text-lg`**, **`font-semibold`**, **`#34495E`**.
- **Right (mandatory):** Close control — **Lucide `X`**, **`variant="ghost"`**, hit area **`h-8 w-8`**, icon color **`#7F8C8D`**, **`aria-label`** from i18n `common.close` (or equivalent).
- **No** redundant header close affordances (e.g. text «Bağla» in the header row) when **`X`** is present.

### Body

- **Padding:** main content area **`p-6`** (24px).
- **Scroll:** scroll the body; keep header (and footer if present) structurally outside the scrolling region when possible.

### Footer

- **`border-t` on the footer is forbidden.** No tinted footer band; separation from the form is **`margin` only** (typically **`mt-6`** above the action row).
- **Layout:** **`flex justify-end gap-2`**.
- **Cancel:** **`variant="outline"`**, white background, gray border **`#D5DADF`**.
- **Primary action:** **`variant="primary"`**, **`#2980B9`**.
- Footer buttons **`h-9`** and **`text-[13px]`** to align with § Form elements.

---

## Layout spacing (forms)

- **Label → field:** **`space-y-1.5`**, or **`mb-1.5`** on the label immediately before the control.
- **Between field groups (vertical):** **`space-y-4`**.
- **Form root inside a modal:** prefer **`space-y-4`**; use **`space-y-3`** only if TZ mandates tighter density.

---

## Typography

- **System fonts:** SF Pro, Segoe UI, sans-serif stack.
- **Base UI size:** **13px** — fields, buttons (see § Buttons), dense tables.
- **Modal / page titles in chrome:** **`text-lg`** (18px) where specified in § Modal & Dialog Standards.

---

## Page chrome & navigation

- **`PageHeader`** (`apps/web/components/layout/page-header.tsx`) is for **full pages only** — title (line 1, left), optional subtitle, **`PageHeader.actions`** (line 2, right: filters, period, primary actions). **Do not** use `PageHeader` inside modals; modals follow § Modal & dialog standards.
- **Registry / list screens:** list filters and page-level actions live **only** in **`PageHeader.actions`** — no duplicate filter strip above the table unless TZ excepts.
- **Cross-module links:** **sidebar only** (PRD §10.1) — no horizontal “app switcher” strip above content.
- **Headings:** page titles **`#34495E`**; primary actions **`#2980B9`**.
- **Contrast:** controls must read clearly on `#EBEDF0`.
- **Sidebar:** every item has a **Lucide** icon.
- **Empty states:** `EmptyState` — centered icon, title, optional description.

---

## Grid

- **Baseline:** strict **4px** grid for spacing and alignment.

---

## Data tables (v1.0)

- **Header:** background `#F8FAFC`, text `#475569` (**11–12px** bold in header cells only — table chrome, not form controls), bottom border `#D5DADF`, **sticky** on long lists.
- **Rows:** white base, hover `#F1F5F9`.
- **Cell data:** **`text-[13px]`** (`text-[13px]` / token equivalents).
- **Alignment:** text left; amounts/dates right (`text-right`), monospace for digits where practical; status centered.
- **Borders:** horizontal **`border-b`** `#D5DADF` only — no vertical grid lines.
- **Density:** `py-2 px-4` (compact).

---

## Table actions & icons

Row actions live in the **last** column (e.g. **`w-[120px]`**). **Lucide** icons.

- **Control shape:** ghost-style hit targets, **`rounded-lg`**, **28×28** or **32×32** px per density token.
- **Icons:** View `Eye` `#2980B9`; Edit `Pencil`/`Edit3` `#7F8C8D`; Send `Send`/`Share2` `#2980B9`; Delete `Trash2` `#E74C3C`; Archive/Lock `#BDC3C7`.
- **Tooltips:** required (AZ/RU action name).

---

## Special instructions

- Desktop tables: prefer horizontal layout.
- **Numeric data:** right-aligned.

---

## Treasury (Bank və Kassa) — v7.1

- Sidebar: `nav.sectionTreasury`, icon **Landmark**.
- **`/banking`:** account cards (101* cash + 221–224 bank) → statement import (dropzone, BANK/CASH) → operations registry (All / Bank / Cash).
- Registry **Mənbə / Источник:** `origin` on lines (import, sync, invoice mirror, manual cash-out).
- **Nəqd məxaric:** `POST /api/banking/cash-out` (731 / 101.01 + registry line).
- **Enterprise:** `SubscriptionAccessService` bypass for `ENTERPRISE` where implemented server-side.
