import { extensionResources } from "./extension";
import { resources } from "./resources";

export { resources } from "./resources";
export { extensionResources } from "./extension";
export {
  getLandingMarketingCopy,
  getLandingPageCopy,
  landingMarketingCopyByLocale,
  landingPageCopyByLocale,
  type LandingFeatureCopy,
  type LandingMarketingCopy,
  type LandingPageCopy,
  type LandingPremiumItemCopy,
} from "./landing-copy";

type LocaleTree = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge translation trees (e.g. web + extension) for i18next `resources`. */
export function mergeLocaleResources(
  base: { ru: LocaleTree; az: LocaleTree },
  extra: { ru: LocaleTree; az: LocaleTree },
): { ru: LocaleTree; az: LocaleTree } {
  const merge = (a: LocaleTree, b: LocaleTree): LocaleTree => {
    const out: LocaleTree = { ...a };
    for (const [k, bv] of Object.entries(b)) {
      const av = out[k];
      if (isPlainObject(av) && isPlainObject(bv)) {
        out[k] = merge(av as LocaleTree, bv as LocaleTree);
      } else {
        out[k] = bv;
      }
    }
    return out;
  };
  return {
    ru: merge(base.ru, extra.ru),
    az: merge(base.az, extra.az),
  };
}

/** Full resources for the browser extension popup/widget (web + extension keys). */
export function getExtensionMergedResources(): {
  ru: LocaleTree;
  az: LocaleTree;
} {
  return mergeLocaleResources(
    resources as { ru: LocaleTree; az: LocaleTree },
    extensionResources as unknown as { ru: LocaleTree; az: LocaleTree },
  );
}
