/**
 * Centralized selectors for emas.sosial.gov.az — update when the portal DOM changes.
 * MVP placeholders: adjust after pilot on the real site.
 */
export const EmasSelectors = {
  /** Any visible user menu / profile block when logged in. */
  authIndicators: [
    '[class*="user"]',
    '[class*="profile"]',
    '[class*="avatar"]',
    "header a[href*='logout']",
    "header button",
  ],
  /**
   * TODO: validate selectors on real ƏMAS pages and keep only stable ones.
   * For now we search common "profile/company" blocks where VÖEN may appear.
   */
  activeVoenCandidates: [
    '[data-testid*="voen"]',
    '[id*="voen"]',
    '[class*="voen"]',
    '[class*="tax"]',
    '[class*="company"]',
    '[class*="profile"]',
    "header",
  ],
  /** Generic text inputs on employment forms (broad; refine per flow). */
  formInputs: "input[type=text], input:not([type]), textarea",
} as const;
