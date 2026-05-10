"use client";

import type { ReactNode } from "react";
import { DATA_TABLE_CLASS, DATA_TABLE_VIEWPORT_CLASS } from "../../lib/design-system";

/**
 * Shared viewport + table shell for Super-Admin data hub lists (sticky header via viewport class).
 */
export function SuperAdminDataTable({ children }: { children: ReactNode }) {
  return (
    <div className={DATA_TABLE_VIEWPORT_CLASS}>
      <table className={DATA_TABLE_CLASS}>{children}</table>
    </div>
  );
}
