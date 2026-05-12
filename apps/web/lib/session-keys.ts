export const ACCESS_TOKEN_KEY = "dayday_access_token";
/** Mirror access token into cookie so Next middleware can gate SSR. */
export const ACCESS_TOKEN_COOKIE_KEY = "dayday_access_token";
export const USER_KEY = "dayday_user";
export const ORGS_KEY = "dayday_organizations";
/** Флаги из GET /auth/me (RBAC UI). */
export const ACCESS_FLAGS_KEY = "dayday_access_flags";
/** External auditor: accepted invite + plaintext token (browser only). */
export const AUDIT_ENGAGEMENT_INVITE_ID_KEY = "dayday_audit_engagement_invite_id";
export const AUDIT_ENGAGEMENT_TOKEN_KEY = "dayday_audit_engagement_token";
