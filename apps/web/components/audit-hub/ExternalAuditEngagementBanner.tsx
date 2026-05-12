"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AUDIT_ENGAGEMENT_INVITE_ID_KEY,
  AUDIT_ENGAGEMENT_TOKEN_KEY,
} from "../../lib/session-keys";
import { useAuditEngagementSession } from "../../lib/audit-engagement-session";

export function ExternalAuditEngagementBanner() {
  const { t } = useTranslation();
  const session = useAuditEngagementSession();

  if (session.phase !== "active") {
    return null;
  }

  function exit() {
    sessionStorage.removeItem(AUDIT_ENGAGEMENT_INVITE_ID_KEY);
    sessionStorage.removeItem(AUDIT_ENGAGEMENT_TOKEN_KEY);
    window.location.href = "/audit-invitations";
  }

  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[13px] text-indigo-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {t("auditHub.externalBanner", { org: session.organizationName })}
        </span>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/audit-invitations"
            className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
          >
            {t("auditHub.externalManage")}
          </Link>
          <button
            type="button"
            className="rounded-md bg-indigo-700 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-800"
            onClick={() => exit()}
          >
            {t("auditHub.externalExit")}
          </button>
        </div>
      </div>
    </div>
  );
}
