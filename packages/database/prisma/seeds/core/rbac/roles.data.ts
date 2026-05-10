import type { UserRole } from "@prisma/client";

type RoleSeedRow = {
  code: string;
  /** Maps to `OrganizationMembership.role`; platform catalog rows use `null` (e.g. SUPER_ADMIN). */
  legacyEnumRole: UserRole | null;
  nameAz: string;
  nameRu: string;
  nameEn: string;
};

/**
 * Organization + platform catalog roles aligned with PRD §7.9 (and `UserRole` enum).
 * SUPER_ADMIN is platform-only (no `UserRole` enum member); stored for future permission sync.
 */
export const ROLES = [
  {
    code: "OWNER",
    legacyEnumRole: "OWNER",
    nameAz: "Sahib",
    nameRu: "Владелец",
    nameEn: "Owner",
  },
  {
    code: "ADMIN",
    legacyEnumRole: "ADMIN",
    nameAz: "Admin",
    nameRu: "Администратор",
    nameEn: "Administrator",
  },
  {
    code: "ACCOUNTANT",
    legacyEnumRole: "ACCOUNTANT",
    nameAz: "Baş mühasib / Mühasib",
    nameRu: "Бухгалтер",
    nameEn: "Accountant",
  },
  {
    code: "USER",
    legacyEnumRole: "USER",
    nameAz: "İstifadəçi",
    nameRu: "Пользователь",
    nameEn: "User",
  },
  {
    code: "PROCUREMENT",
    legacyEnumRole: "PROCUREMENT",
    nameAz: "Satınalma",
    nameRu: "Снабжение / закупки",
    nameEn: "Procurement",
  },
  {
    code: "AUDITOR",
    legacyEnumRole: "AUDITOR",
    nameAz: "Daxili auditor",
    nameRu: "Аудитор",
    nameEn: "Auditor",
  },
  {
    code: "WAREHOUSE_KEEPER",
    legacyEnumRole: "WAREHOUSE_KEEPER",
    nameAz: "Anbardar",
    nameRu: "Кладовщик",
    nameEn: "Warehouse keeper",
  },
  {
    code: "HR_OFFICER",
    legacyEnumRole: "HR_OFFICER",
    nameAz: "HR əməkdaşı",
    nameRu: "Специалист по кадрам",
    nameEn: "HR officer",
  },
  {
    code: "HR_MANAGER",
    legacyEnumRole: "HR_MANAGER",
    nameAz: "HR menecer",
    nameRu: "HR-менеджер",
    nameEn: "HR manager",
  },
  {
    code: "DEPARTMENT_HEAD",
    legacyEnumRole: "DEPARTMENT_HEAD",
    nameAz: "Şöbə müdiri",
    nameRu: "Руководитель подразделения",
    nameEn: "Department head",
  },
  {
    code: "DIRECTOR",
    legacyEnumRole: "DIRECTOR",
    nameAz: "Direktor",
    nameRu: "Директор",
    nameEn: "Director",
  },
  {
    code: "SUPER_ADMIN",
    legacyEnumRole: null,
    nameAz: "Super admin",
    nameRu: "Супер-администратор",
    nameEn: "Super administrator",
  },
] as const satisfies readonly RoleSeedRow[];
