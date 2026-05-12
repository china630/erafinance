"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch, apiPostKeepalive } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_TEXTAREA_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import {
  EARLY_ACCESS_MODULES,
  type EarlyAccessModuleKey,
} from "./modules.config";

type Step = "landing" | "survey" | "thanks";

type MineRow = { moduleKey: string; createdAt: string; updatedAt: string };

const INDUSTRY_SLUGS = [
  "retail",
  "construction",
  "logistics",
  "services",
  "manufacturing",
  "other",
] as const;

export function EarlyAccessLandingModal({
  moduleKey,
  onClose,
}: {
  moduleKey: EarlyAccessModuleKey;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cfg = EARLY_ACCESS_MODULES[moduleKey];
  const Icon = cfg.icon;
  const i18nKey = cfg.i18nKey;

  const [step, setStep] = useState<Step>("landing");
  const [mine, setMine] = useState<MineRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [industry, setIndustry] = useState<string>("");
  const [surveyAnswer, setSurveyAnswer] = useState("");

  const sessionIdRef = useRef<string>("");
  const openedAtRef = useRef<number>(0);

  const postEvent = useCallback(
    async (eventType: string, extra?: { durationMs?: number }) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const res = await apiFetch("/api/early-access/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleKey,
            eventType,
            sessionId: sid,
            ...extra,
          }),
        });
        if (!res.ok) {
          /* non-blocking funnel */
        }
      } catch {
        /* ignore */
      }
    },
    [moduleKey],
  );

  useEffect(() => {
    sessionIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    openedAtRef.current = Date.now();
    void postEvent("VIEW_CLICK");
    void postEvent("MODAL_OPEN");

    void (async () => {
      try {
        const res = await apiFetch("/api/early-access/me");
        if (res.ok) {
          const data = (await res.json()) as MineRow[];
          setMine(Array.isArray(data) ? data : []);
        }
      } catch {
        setMine([]);
      }
    })();

    return () => {
      const durationMs = Math.max(0, Date.now() - openedAtRef.current);
      const sid = sessionIdRef.current;
      if (!sid) return;
      apiPostKeepalive("/api/early-access/events", {
        moduleKey,
        eventType: "MODAL_CLOSE",
        sessionId: sid,
        durationMs,
      });
    };
  }, [moduleKey, postEvent]);

  const existing = useMemo(
    () => mine?.find((r) => r.moduleKey === moduleKey) ?? null,
    [mine, moduleKey],
  );

  const painKeys = useMemo(
    () => [`earlyAccess.${i18nKey}.pain1`, `earlyAccess.${i18nKey}.pain2`, `earlyAccess.${i18nKey}.pain3`, `earlyAccess.${i18nKey}.pain4`] as const,
    [i18nKey],
  );
  const featureKeys = useMemo(
    () =>
      [`earlyAccess.${i18nKey}.feature1`, `earlyAccess.${i18nKey}.feature2`, `earlyAccess.${i18nKey}.feature3`, `earlyAccess.${i18nKey}.feature4`] as const,
    [i18nKey],
  );

  const title = t(`earlyAccess.${i18nKey}.title`);
  const tagline = t(`earlyAccess.${i18nKey}.tagline`);
  const priceHook = t(`earlyAccess.${i18nKey}.priceHook`);
  const preorderLabel = t("earlyAccess.cta.preorder", {
    price: String(cfg.priceAzn),
  });

  const onPreorder = async () => {
    if (existing) return;
    await postEvent("CTA_CLICK");
    setStep("survey");
  };

  const onSubmitSurvey = async () => {
    if (!industry) {
      toast.error(t("earlyAccess.industryRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/early-access/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleKey,
          industry,
          surveyAnswer: surveyAnswer.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(txt.slice(0, 200) || t("common.apiErrorTitle"));
        return;
      }
      setStep("thanks");
      void (async () => {
        const r = await apiFetch("/api/early-access/me");
        if (r.ok) {
          const data = (await r.json()) as MineRow[];
          setMine(Array.isArray(data) ? data : []);
        }
      })();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg max-h-[90vh] overflow-y-auto`}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D5DADF] bg-[#EBEDF0]">
              <Icon className="h-5 w-5 text-[#2980B9]" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#34495E]">{title}</h2>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  {t("earlyAccess.beta")}
                </span>
              </div>
              <p className="text-[13px] text-[#7F8C8D] mt-1">{tagline}</p>
            </div>
          </div>
        </DialogHeader>

        <button
          type="button"
          className={MODAL_CLOSE_BUTTON_CLASS}
          onClick={onClose}
          aria-label={t("earlyAccess.close")}
        >
          <X className="h-4 w-4" />
        </button>

        {step === "landing" ? (
          <div className="mt-4 space-y-4 text-[13px] text-[#34495E]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#7F8C8D] mb-2">
                {t(`earlyAccess.${i18nKey}.painsTitle`)}
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {painKeys.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-[#7F8C8D] mb-2">
                {t(`earlyAccess.${i18nKey}.featuresTitle`)}
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {featureKeys.map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </div>
            <p className="font-semibold text-[#2980B9]">{priceHook}</p>

            {existing ? (
              <p className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] px-3 py-2 text-[13px] text-[#34495E]">
                {t("earlyAccess.alreadyOnWaitlist", {
                  date: new Date(existing.updatedAt).toLocaleDateString(),
                })}
              </p>
            ) : null}

            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={onClose}
              >
                {t("earlyAccess.close")}
              </Button>
              <Button
                type="button"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => void onPreorder()}
                disabled={Boolean(existing)}
              >
                {preorderLabel}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "survey" ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmitSurvey();
            }}
          >
            <div>
              <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ea-industry">
                {t("earlyAccess.industryLabel")}
              </label>
              <select
                id="ea-industry"
                className="w-full rounded-lg border border-[#D5DADF] bg-white px-3 py-2 text-[13px] text-[#34495E]"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              >
                <option value="">{t("earlyAccess.industryPlaceholder")}</option>
                {INDUSTRY_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {t(`earlyAccess.industry.${slug}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="ea-survey">
                {t("earlyAccess.surveyQuestion")}
              </label>
              <textarea
                id="ea-survey"
                className={MODAL_TEXTAREA_CLASS}
                rows={4}
                value={surveyAnswer}
                onChange={(e) => setSurveyAnswer(e.target.value)}
                placeholder={t("earlyAccess.surveyPlaceholder")}
              />
            </div>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setStep("landing")}
                disabled={busy}
              >
                {t("earlyAccess.back")}
              </Button>
              <Button
                type="submit"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={busy}
              >
                {t("earlyAccess.submitSurvey")}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "thanks" ? (
          <div className="mt-4 space-y-4 text-[13px] text-[#34495E]">
            <p className="font-semibold text-[#34495E]">{t("earlyAccess.thanksTitle")}</p>
            <p className="text-[#7F8C8D]">{t("earlyAccess.thanksBody")}</p>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={onClose}
              >
                {t("earlyAccess.close")}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
