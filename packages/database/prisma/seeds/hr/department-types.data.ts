/**
 * Global department type catalog (tenant `Department` still uses free names).
 * Aligned with PRD §7.9 role families: procurement, warehouse, finance, HR, etc.
 */
export const DEPARTMENT_TYPES = [
  { code: "ADMINISTRATION", nameAz: "İnzibati", nameRu: "Администрация", nameEn: "Administration", sortOrder: 0 },
  { code: "FINANCE", nameAz: "Maliyyə və uçot", nameRu: "Финансы и учёт", nameEn: "Finance & accounting", sortOrder: 1 },
  { code: "SALES", nameAz: "Satış", nameRu: "Продажи", nameEn: "Sales", sortOrder: 2 },
  { code: "PROCUREMENT", nameAz: "Satınalma", nameRu: "Закупки и снабжение", nameEn: "Procurement", sortOrder: 3 },
  { code: "WAREHOUSE", nameAz: "Anbar və logistika", nameRu: "Склад и логистика", nameEn: "Warehouse & logistics", sortOrder: 4 },
  { code: "PRODUCTION", nameAz: "İstehsalat", nameRu: "Производство", nameEn: "Production", sortOrder: 5 },
  { code: "HR", nameAz: "İnsan resursları", nameRu: "Кадры и HR", nameEn: "Human resources", sortOrder: 6 },
  { code: "IT", nameAz: "İT", nameRu: "ИТ", nameEn: "IT", sortOrder: 7 },
] as const;
