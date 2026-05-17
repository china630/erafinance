"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { EmptyState } from "../../components/empty-state";
import { Button } from "../../components/ui/button";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type PartnerDashboard = {
  partner: {
    id: string;
    code: string;
    displayName: string;
    isCorporate: boolean;
    fixedRatePercent: string | null;
  };
  referralUrl: string;
  stats: {
    referredOrganizationsTotal: number;
    activeReferrals: number;
    pendingCommissionAzn: number;
  };
};

export default function PartnerDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/partner/dashboard");
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) {
      setQrUrl(null);
      return;
    }
    let revoked = false;
    void (async () => {
      const res = await apiFetch("/api/partner/qr.png");
      if (!res.ok || revoked) return;
      const blob = await res.blob();
      if (revoked) return;
      setQrUrl(URL.createObjectURL(blob));
    })();
    return () => {
      revoked = true;
      setQrUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
    };
  }, [data]);

  if (loading) {
    return (
      <div className="text-sm text-[#7F8C8D] py-12 text-center">
        {t("common.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title={t("partner.noProfileTitle")}
        description={t("partner.noProfileHint")}
        className="border-solid border-[#D5DADF] bg-white"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-[#34495E]">{t("partner.pageTitle")}</h1>
        <p className="text-[13px] text-[#7F8C8D] mt-1">{data.partner.displayName}</p>
      </div>

      <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden />
            {t("superAdmin.billingRetryLoad")}
          </Button>
        </div>
        <div>
          <div className="text-xs font-semibold text-[#7F8C8D] uppercase">
            {t("partner.codeLabel")}
          </div>
          <div className="font-mono text-lg text-[#34495E]">{data.partner.code}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[#7F8C8D] uppercase">
            {t("partner.linkLabel")}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-sm text-[#34495E] break-all">{data.referralUrl}</span>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center gap-1 shrink-0`}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(data.referralUrl);
                  toast.success(t("partner.copied"));
                } catch {
                  toast.error(t("common.saveErr"));
                }
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t("partner.copyLink")}
            </button>
          </div>
        </div>
        {qrUrl ? (
          <div>
            <div className="text-xs font-semibold text-[#7F8C8D] uppercase mb-2">
              {t("partner.qrLabel")}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR" className="h-40 w-40 border border-[#D5DADF] rounded-lg" />
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-[#EBEDF0] bg-[#F8F9FA] p-3">
            <div className="text-xs text-[#7F8C8D]">{t("partner.statOrgs")}</div>
            <div className="text-lg font-semibold tabular-nums text-[#34495E]">
              {data.stats.referredOrganizationsTotal}
            </div>
          </div>
          <div className="rounded-lg border border-[#EBEDF0] bg-[#F8F9FA] p-3">
            <div className="text-xs text-[#7F8C8D]">{t("partner.statActiveWindow")}</div>
            <div className="text-lg font-semibold tabular-nums text-[#34495E]">
              {data.stats.activeReferrals}
            </div>
          </div>
          <div className="rounded-lg border border-[#EBEDF0] bg-[#F8F9FA] p-3">
            <div className="text-xs text-[#7F8C8D]">{t("partner.statPendingAzn")}</div>
            <div className="text-lg font-semibold tabular-nums text-[#34495E]">
              {data.stats.pendingCommissionAzn}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
