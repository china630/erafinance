"use client";

import type { ReactNode } from "react";

/**
 * Single vertical scroll for invoice/purchase document forms inside a modal shell.
 * Pin actions (totals, checkboxes) in `footerActions` outside the scroll region.
 */
export function InvoiceDocumentModalLayout({
  children,
  footerActions,
  className = "",
}: {
  children: ReactNode;
  footerActions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`.trim()}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">{children}</div>
      {footerActions != null ? <div className="shrink-0">{footerActions}</div> : null}
    </div>
  );
}
