import type { EarlyAccessModuleKey } from "../components/early-access/modules.config";
import type { SubscriptionSnapshot } from "./subscription-context";

export const INDUSTRY_MODULE_SLUGS = [
  "industry_retail_ecom",
  "industry_logistics_customs",
  "industry_construction",
  "industry_crm_whatsapp",
] as const;

export type IndustryModuleSlug = (typeof INDUSTRY_MODULE_SLUGS)[number];

export const INDUSTRY_NAV_ITEMS: Array<{
  key: EarlyAccessModuleKey;
  slug: IndustryModuleSlug;
  href: string;
  vertical: string;
  moduleField:
    | "industryRetailEcom"
    | "industryLogisticsCustoms"
    | "industryConstruction"
    | "industryCrmWhatsapp";
  labelKey:
    | "nav.industryRetailEcom"
    | "nav.industryLogisticsCustoms"
    | "nav.industryConstruction"
    | "nav.industryCrmWhatsapp";
}> = [
  {
    key: "RETAIL_ECOM",
    slug: "industry_retail_ecom",
    href: "/industry/retail",
    vertical: "retail",
    moduleField: "industryRetailEcom",
    labelKey: "nav.industryRetailEcom",
  },
  {
    key: "LOGISTICS_CUSTOMS",
    slug: "industry_logistics_customs",
    href: "/industry/logistics",
    vertical: "logistics",
    moduleField: "industryLogisticsCustoms",
    labelKey: "nav.industryLogisticsCustoms",
  },
  {
    key: "CONSTRUCTION",
    slug: "industry_construction",
    href: "/industry/construction",
    vertical: "construction",
    moduleField: "industryConstruction",
    labelKey: "nav.industryConstruction",
  },
  {
    key: "CRM_WHATSAPP",
    slug: "industry_crm_whatsapp",
    href: "/industry/crm",
    vertical: "crm",
    moduleField: "industryCrmWhatsapp",
    labelKey: "nav.industryCrmWhatsapp",
  },
];

export function industryItemByVertical(
  vertical: string,
): (typeof INDUSTRY_NAV_ITEMS)[number] | undefined {
  return INDUSTRY_NAV_ITEMS.find((i) => i.vertical === vertical);
}

export function hasIndustryModuleAccess(
  snap: SubscriptionSnapshot | null,
  key: EarlyAccessModuleKey,
): boolean {
  if (!snap) return false;
  const item = INDUSTRY_NAV_ITEMS.find((i) => i.key === key);
  if (!item) return false;
  if (snap.activeModules.includes(item.slug)) return true;
  return Boolean(snap.modules[item.moduleField]);
}
