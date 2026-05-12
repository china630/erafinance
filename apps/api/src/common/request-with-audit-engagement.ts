import type { AuthUser } from "../auth/types/auth-user";

export type AuditEngagementInvitePermissions = {
  auditHubRead?: boolean;
  auditNotesWrite?: boolean;
  auditBulkExport?: boolean;
};

/** Optional fields set by AuditEngagementResolveGuard when invite headers are valid. */
export type RequestWithAuditEngagement = {
  user?: AuthUser;
  auditEngagementEffectiveOrgId?: string;
  auditEngagementInviteId?: string;
  auditEngagementInvitePermissions?: AuditEngagementInvitePermissions;
  /** Client org display name when engagement headers are valid. */
  auditEngagementClientOrgName?: string;
};
