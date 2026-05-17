"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { MODAL_INPUT_CLASS } from "../../lib/design-system";

export type NasBankAccountOption = {
  id: string;
  code: string;
  displayName: string;
  currency: string;
};

function isBankLedgerNasCode(code: string): boolean {
  const c = code.trim();
  if (c === "221" || c.startsWith("221.")) return true;
  for (const r of ["222", "223", "224"] as const) {
    if (c === r || c.startsWith(`${r}.`)) return true;
  }
  return false;
}

export function filterNasBankLedgerAccounts<T extends { code: string }>(rows: T[]): T[] {
  return rows.filter((r) => isBankLedgerNasCode(r.code));
}

type Props = {
  value: string;
  onChange: (accountId: string) => void;
  accounts: NasBankAccountOption[];
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
};

/**
 * Smart Aliases: основной текст — название + валюта; код NAS — бейдж. `value` / `onChange` — UUID счёта.
 * Dropdown is portaled so it stacks above modal dialogs.
 */
export function NasBankAccountSelect({
  value,
  onChange,
  accounts,
  disabled,
  placeholder = "—",
  emptyLabel = "—",
}: Props) {
  const [open, setOpen] = useState(false);
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listPortalRef = useRef<HTMLUListElement>(null);

  const selected = accounts.find((a) => a.id === value);

  const updatePortalRect = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPortalRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, updatePortalRect]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listPortalRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1">
      <button
        type="button"
        disabled={disabled || accounts.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={[
          MODAL_INPUT_CLASS,
          "flex w-full min-w-0 items-center justify-between gap-2 text-left",
          disabled || accounts.length === 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="min-w-0 flex-1 truncate">
          {accounts.length === 0 ? (
            <span className="text-[13px] text-[#7F8C8D]">{emptyLabel}</span>
          ) : selected ? (
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-[#34495E]">
                {selected.displayName} ({selected.currency})
              </span>
              <span className="shrink-0 rounded-lg px-1 text-[10px] font-medium text-[#7F8C8D] bg-[#F4F5F7]">
                {selected.code}
              </span>
            </span>
          ) : (
            <span className="text-[13px] text-[#7F8C8D]">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
      </button>
      {open &&
      accounts.length > 0 &&
      portalRect &&
      typeof document !== "undefined" &&
      createPortal(
        <ul
          ref={listPortalRef}
          className="fixed z-[9999] max-h-60 overflow-auto rounded-2xl border border-[#D5DADF] bg-white p-1 shadow-md"
          style={{
            top: portalRect.top,
            left: portalRect.left,
            width: portalRect.width,
          }}
          role="listbox"
        >
          {accounts.map((a) => (
            <li key={a.id} role="option" aria-selected={a.id === value}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-[#34495E] hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {a.displayName} ({a.currency})
                </span>
                <span className="shrink-0 rounded-lg px-1 text-[10px] font-medium text-[#7F8C8D] bg-[#F4F5F7]">
                  {a.code}
                </span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
