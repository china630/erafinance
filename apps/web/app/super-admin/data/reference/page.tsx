"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../../components/layout/page-header";
import { apiFetch } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "../../../../lib/design-system";

export default function DataHubReferencePage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [json, setJson] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/reference/snapshot");
    if (!res.ok) {
      toast.error(await res.text());
      setJson("");
    } else {
      const data = await res.json();
      setJson(JSON.stringify(data, null, 2));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("superAdmin.dataHubReference")} subtitle={t("superAdmin.dataHubReadOnly")} />
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
        {t("superAdminTranslations.refresh")}
      </button>
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-h-[70vh] overflow-auto">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
