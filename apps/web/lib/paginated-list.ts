export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** Parses `{ items, total, page, pageSize }` or a legacy JSON array. */
export function parsePaginatedList<T>(json: unknown): PaginatedList<T> {
  if (Array.isArray(json)) {
    const arr = json as T[];
    return {
      items: arr,
      total: arr.length,
      page: 1,
      pageSize: arr.length || 1,
    };
  }
  const o = json as Partial<PaginatedList<T>>;
  return {
    items: Array.isArray(o.items) ? o.items : [],
    total: typeof o.total === "number" ? o.total : 0,
    page: typeof o.page === "number" ? o.page : 1,
    pageSize: typeof o.pageSize === "number" ? o.pageSize : 25,
  };
}
