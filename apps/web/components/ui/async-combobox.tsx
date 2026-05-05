"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MODAL_INPUT_CLASS } from "../../lib/design-system";

/** DESIGN.md § Form elements — same tokens as {@link MODAL_INPUT_CLASS}; flex + chevron padding. */
const TRIGGER_INPUT_CLASS = [
  MODAL_INPUT_CLASS,
  "flex min-w-0 items-center gap-2 text-left pr-9 outline-none transition",
].join(" ");

/** Popover list shell: DESIGN.md outer chrome `!rounded-2xl`, inner padding `p-1`. */
const LIST_PANEL_SHELL =
  "max-h-60 overflow-y-auto !rounded-2xl border border-[#D5DADF] bg-white p-1 text-[13px] text-[#34495E] shadow-md";

const LIST_PANEL_INLINE = `absolute left-0 right-0 top-full z-[80] mt-1 ${LIST_PANEL_SHELL}`;

const LIST_PANEL_PORTAL = `fixed z-[200] ${LIST_PANEL_SHELL}`;

export type AsyncComboboxFetcher<T extends { id: string }> = (query: string) => Promise<T[]>;

export type AsyncComboboxProps<T extends { id: string }> = {
  value: string;
  onChange: (id: string, item: T | null) => void;
  fetcher: AsyncComboboxFetcher<T>;
  getOptionLabel: (item: T) => string;
  placeholder: string;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
  /** Подпись выбранного пункта (для закрытого состояния, пока нет нового выбора в этой сессии). */
  selectedLabel?: string;
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  /** Дополнительный класс для выпадающего списка (например, в таблице). */
  listClassName?: string;
  /** Render list in `document.body` (fixed layer) to avoid `overflow` clipping in dense tables/modals. */
  portaled?: boolean;
};

export function AsyncCombobox<T extends { id: string }>(props: AsyncComboboxProps<T>) {
  const {
    value,
    onChange,
    fetcher,
    getOptionLabel,
    placeholder,
    debounceMs = 300,
    className = "",
    disabled = false,
    selectedLabel = "",
    id: idProp,
    "aria-invalid": ariaInvalid,
    listClassName = "",
    portaled = false,
  } = props;
  const { t } = useTranslation();
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const inputId = idProp ?? `${autoId}-input`;

  const rootRef = useRef<HTMLDivElement>(null);
  const listPortalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const wasOpenRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<T | null>(null);

  const closedDisplay =
    value && (picked?.id === value ? getOptionLabel(picked) : selectedLabel.trim())
      ? picked?.id === value
        ? getOptionLabel(picked)
        : selectedLabel.trim()
      : "";

  const runFetch = useCallback(
    async (query: string, seq: number) => {
      setLoading(true);
      try {
        const rows = await fetcher(query);
        if (seq !== requestSeq.current) return;
        setItems(Array.isArray(rows) ? rows : []);
        setHighlight(0);
      } catch {
        if (seq !== requestSeq.current) return;
        setItems([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [fetcher],
  );

  useEffect(() => {
    if (!value) {
      setPicked(null);
      return;
    }
    if (picked && picked.id !== value) {
      setPicked(null);
    }
  }, [value, picked]);

  const updatePortalRect = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPortalRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open || !portaled) {
      setPortalRect(null);
      return;
    }
    updatePortalRect();
    window.addEventListener("scroll", updatePortalRect, true);
    window.addEventListener("resize", updatePortalRect);
    return () => {
      window.removeEventListener("scroll", updatePortalRect, true);
      window.removeEventListener("resize", updatePortalRect);
    };
  }, [open, portaled, updatePortalRect]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (portaled && listPortalRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, portaled]);

  const scheduleFetch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const seq = ++requestSeq.current;
        void runFetch(query, seq);
      }, debounceMs);
    },
    [debounceMs, runFetch],
  );

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    const firstOpen = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (firstOpen) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const seq = ++requestSeq.current;
      void runFetch(draft, seq);
    } else {
      scheduleFetch(draft);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, open, runFetch, scheduleFetch]);

  function pick(item: T) {
    setPicked(item);
    onChange(item.id, item);
    setOpen(false);
    setDraft("");
    setItems([]);
    inputRef.current?.blur();
  }

  const listInner = (
    <>
      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-[#7F8C8D]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {t("ui.asyncComboboxSearching")}
        </div>
      ) : null}
      {!loading && items.length === 0 ? (
        <div className="rounded-lg px-2 py-2 text-[13px] text-[#7F8C8D]">{t("ui.asyncComboboxEmpty")}</div>
      ) : null}
      {items.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={item.id === value}
          className={[
            "flex w-full cursor-pointer rounded-lg px-2 py-2 text-left text-[13px] text-[#34495E]",
            "hover:bg-slate-100 focus:bg-slate-100 focus:outline-none",
            idx === highlight ? "bg-slate-100" : "",
          ].join(" ")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(item)}
        >
          {getOptionLabel(item)}
        </button>
      ))}
    </>
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setDraft(closedDisplay);
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = items[highlight];
      if (row) pick(row);
    }
  }

  return (
    <div ref={rootRef} className={["relative min-w-0", className].filter(Boolean).join(" ")}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid === true || ariaInvalid === "true" ? true : undefined}
          disabled={disabled}
          placeholder={open ? placeholder : closedDisplay ? undefined : placeholder}
          value={open ? draft : closedDisplay}
          onChange={(e) => {
            const v = e.target.value;
            if (!open) setOpen(true);
            setDraft(v);
          }}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setDraft(closedDisplay);
          }}
          onKeyDown={onKeyDown}
          className={[
            TRIGGER_INPUT_CLASS,
            ariaInvalid === true || ariaInvalid === "true" ? "border-red-500 ring-2 ring-red-500/25" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          autoComplete="off"
        />
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-[#7F8C8D]"
          aria-hidden
        />
        {loading ? (
          <span className="pointer-events-none absolute right-8 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] text-[#7F8C8D]">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          </span>
        ) : null}
      </div>
      {open && !portaled ? (
        <div
          id={listboxId}
          role="listbox"
          className={[LIST_PANEL_INLINE, listClassName].filter(Boolean).join(" ")}
        >
          {listInner}
        </div>
      ) : null}
      {open && portaled && portalRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={listPortalRef}
              id={listboxId}
              role="listbox"
              style={{
                top: portalRect.top,
                left: portalRect.left,
                width: portalRect.width,
              }}
              className={[LIST_PANEL_PORTAL, listClassName].filter(Boolean).join(" ")}
            >
              {listInner}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
