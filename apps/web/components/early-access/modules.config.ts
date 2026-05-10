import type { LucideIcon } from "lucide-react";
import { HardHat, MessageSquare, ShoppingBag, Truck } from "lucide-react";

/** Mirrors Prisma enum `EarlyAccessModuleKey` (painted-door verticals). */
export type EarlyAccessModuleKey =
  | "RETAIL_ECOM"
  | "LOGISTICS_CUSTOMS"
  | "CONSTRUCTION"
  | "CRM_WHATSAPP";

export const EARLY_ACCESS_MODULE_ORDER: EarlyAccessModuleKey[] = [
  "RETAIL_ECOM",
  "LOGISTICS_CUSTOMS",
  "CONSTRUCTION",
  "CRM_WHATSAPP",
];

export const EARLY_ACCESS_MODULES: Record<
  EarlyAccessModuleKey,
  { icon: LucideIcon; priceAzn: number; i18nKey: string }
> = {
  RETAIL_ECOM: { icon: ShoppingBag, priceAzn: 15, i18nKey: "retailEcom" },
  LOGISTICS_CUSTOMS: { icon: Truck, priceAzn: 25, i18nKey: "logisticsCustoms" },
  CONSTRUCTION: { icon: HardHat, priceAzn: 20, i18nKey: "construction" },
  CRM_WHATSAPP: { icon: MessageSquare, priceAzn: 10, i18nKey: "crmWhatsapp" },
};
