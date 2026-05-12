"use client";

import { useEffect, useMemo, useState } from "react";
import { PlugZap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSubscription } from "../lib/subscription-context";

const DISMISS_KEY = "erafinance:extension-install-banner-dismissed-at";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function installUrl(): string {
  const v = process.env.NEXT_PUBLIC_EXTENSION_INSTALL_URL?.trim();
  return v && v.length > 0 ? v : "/docs/extension";
}

export function ExtensionInstallBanner(props: {
  variant: "banner" | "card";
  dismissible?: boolean;
}) {
  const { t } = useTranslation();
  const { effectiveSnapshot } = useSubscription();
  const [hidden, setHidden] = useState(false);
  const href = useMemo(() => installUrl(), []);

  useEffect(() => {
    if (!props.dismissible) return;
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return;
      if (Date.now() - ts < DISMISS_TTL_MS) {
        setHidden(true);
      } else {
        window.localStorage.removeItem(DISMISS_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [props.dismissible]);

  if (hidden) return null;
  if (props.variant === "banner" && effectiveSnapshot?.modules?.taxPro) return null;

  const isBanner = props.variant === "banner";
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 shadow-sm",
        isBanner
          ? "border-[#BFDDF2] bg-[#EFF7FC]"
          : "border-[#D5DADF] bg-white",
      ].join(" ")}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-[#D5DADF] bg-white p-2">
          <PlugZap className="h-5 w-5 text-[#2980B9]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#34495E]">
            {t("extension.cta.title")}
          </p>
          <p className="mt-1 text-[13px] text-[#5D6D7E]">{t("extension.cta.body")}</p>
          <a
            href={href}
            className="mt-2 inline-flex text-[13px] font-semibold text-[#2980B9] underline underline-offset-2"
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
          >
            {t("extension.cta.cta")}
          </a>
        </div>
        {props.dismissible ? (
          <button
            type="button"
            className="rounded-md border border-[#D5DADF] px-2 py-1 text-[12px] text-[#5D6D7E] hover:bg-[#F8F9FA]"
            onClick={() => {
              setHidden(true);
              try {
                window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
              } catch {
                /* ignore */
              }
            }}
          >
            {t("common.close")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
