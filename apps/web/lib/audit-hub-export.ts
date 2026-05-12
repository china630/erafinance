import * as XLSX from "xlsx";

/** Flatten nested values for CSV cells (objects → JSON string). */
function cellValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function downloadAuditHubCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    const blob = new Blob(["\uFEFF"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const keys = Array.from(
    rows.reduce((acc, row) => {
      for (const k of Object.keys(row)) acc.add(k);
      return acc;
    }, new Set<string>()),
  );
  const esc = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    keys.map(esc).join(","),
    ...rows.map((row) => keys.map((k) => esc(cellValue(row[k]))).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAuditHubXlsx(
  filename: string,
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>,
) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    if (rows.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["(empty)"]]), truncateSheetName(name));
      continue;
    }
    const keys = Array.from(
      rows.reduce((acc, row) => {
        for (const k of Object.keys(row)) acc.add(k);
        return acc;
      }, new Set<string>()),
    );
    const aoa = [keys, ...rows.map((row) => keys.map((k) => cellValue(row[k])))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, truncateSheetName(name));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function truncateSheetName(name: string): string {
  const safe = name.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
  return safe || "Sheet";
}
