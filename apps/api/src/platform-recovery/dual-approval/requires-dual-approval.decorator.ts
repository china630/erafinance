import { SetMetadata } from "@nestjs/common";
import { REQUIRES_DUAL_APPROVAL_PURPOSE_KEY } from "./dual-approval.constants";

/** Body must include `dualApprovalRequestId` matching this purpose and APPROVED status. */
export const RequiresDualApproval = (purpose: string) =>
  SetMetadata(REQUIRES_DUAL_APPROVAL_PURPOSE_KEY, purpose);
