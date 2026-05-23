/**
 * Landing marketing strings — import only from `@erafinance/i18n/landing-copy`, not the main
 * package barrel (which pulls `resources.ts` and triggered dev tree-shaking of nested copy).
 */
export {
  getLandingMarketingCopy,
  landingMarketingCopyByLocale,
  type EcosystemModuleCopy,
  type EcosystemModuleStatus,
  type EcosystemSectionCopy,
  type LandingEcosystemCopy,
  type LandingFeatureCopy,
  type LandingLegacyCompareCopy,
  type LandingLegacyCompareRow,
  type LandingMarketingCopy,
  type LandingPremiumItemCopy,
  type LandingZeroKnowledgeClaim,
  type LandingZeroKnowledgeCopy,
} from "@erafinance/i18n/landing-copy";
