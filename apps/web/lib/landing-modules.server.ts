import { apiBaseUrl } from "./api-client";
import {
  LANDING_MODULE_MARKETING_DEFAULTS,
  type LandingModuleMarketingItem,
} from "./config/landing-modules";

export async function fetchLandingModules(): Promise<LandingModuleMarketingItem[]> {
  const base = apiBaseUrl();
  try {
    const res = await fetch(`${base}/api/public/landing-modules`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [...LANDING_MODULE_MARKETING_DEFAULTS];
    const data = (await res.json()) as { items?: LandingModuleMarketingItem[] };
    const items = data.items ?? [];
    if (items.length === 0) return [...LANDING_MODULE_MARKETING_DEFAULTS];
    return items;
  } catch {
    return [...LANDING_MODULE_MARKETING_DEFAULTS];
  }
}
