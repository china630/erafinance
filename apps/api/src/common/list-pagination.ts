export type ListPagination = { page: number; pageSize: number; skip: number };

/**
 * Server-side list pagination (aligned with invoices list API).
 * @param defaultPageSize used when `pageSize` is undefined (e.g. 50 for wide inventory tables).
 */
export function normalizeListPagination(
  page?: number,
  pageSize?: number,
  defaultPageSize = 25,
): ListPagination {
  const p = Math.max(1, page ?? 1);
  const ps = Math.min(200, Math.max(1, pageSize ?? defaultPageSize));
  return { page: p, pageSize: ps, skip: (p - 1) * ps };
}
