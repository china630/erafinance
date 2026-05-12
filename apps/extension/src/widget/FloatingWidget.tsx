import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { getExtensionMergedResources } from "@erafinance/i18n";
import { matchPortal } from "../connectors/registry";
import { AwaitAsanStep } from "./steps/AwaitAsanStep";
import { AutofillStep } from "./steps/AutofillStep";
import { CaptureBgdStep } from "./steps/CaptureBgdStep";
import { AwaitSignStep } from "./steps/AwaitSignStep";
import type { OrgSummary } from "@erafinance/api-contracts";
import type { PortalPrefillFlow } from "../shared/messages";

function pickLang(): "ru" | "az" {
  try {
    const u = chrome?.i18n?.getUILanguage?.() ?? "ru";
    return u.toLowerCase().startsWith("az") ? "az" : "ru";
  } catch {
    return "ru";
  }
}

function makeT(lng: "ru" | "az") {
  const merged = getExtensionMergedResources();
  const tree = merged[lng].translation as Record<string, unknown>;
  return (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = tree;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
}

type Step = 1 | 2 | 3;
type MismatchContext = { erpVoen: string; portalVoen: string };

const shell: CSSProperties = {
  width: 300,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  padding: 8,
  fontFamily: "system-ui, sans-serif",
  color: "#0f172a",
  boxSizing: "border-box",
};

function isDebugBadgeEnabled(): boolean {
  try {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("erafinanceAssistantDebug") === "1") return true;
    return window.localStorage.getItem("erafinanceAssistantDebug") === "1";
  } catch {
    return false;
  }
}

export function FloatingWidget(props: {
  erpActiveOrganization: OrgSummary | null;
  flow: PortalPrefillFlow;
}) {
  const lng = useMemo(() => pickLang(), []);
  const t = useMemo(() => makeT(lng), [lng]);
  const connector = useMemo(() => matchPortal(window.location.href), []);
  const [step, setStep] = useState<Step>(1);
  const [authState, setAuthState] = useState(
    connector?.detectAuthState(document) ?? "unknown",
  );
  const [portalVoen, setPortalVoen] = useState<string | null>(null);
  const debugBadgeEnabled = useMemo(() => isDebugBadgeEnabled(), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAuthState(connector?.detectAuthState(document) ?? "unknown");
    }, 1500);
    return () => window.clearInterval(id);
  }, [connector]);

  useEffect(() => {
    if (!connector) return () => undefined;
    let cancelled = false;
    const id = window.setInterval(() => {
      void connector.detectActiveVoen(document).then((voen) => {
        if (!cancelled) setPortalVoen(voen);
      });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connector]);

  useEffect(() => {
    if (authState === "authenticated" && step === 1) setStep(2);
  }, [authState, step]);

  const mismatch = useMemo<MismatchContext | null>(() => {
    const erpVoen = props.erpActiveOrganization?.taxId ?? "";
    if (!erpVoen) return null;
    if (authState !== "authenticated") return null;
    if (!portalVoen) {
      return { erpVoen, portalVoen: "unknown" };
    }
    if (portalVoen !== erpVoen) {
      return { erpVoen, portalVoen };
    }
    return null;
  }, [authState, portalVoen, props.erpActiveOrganization?.taxId]);

  const blockedReason = mismatch
    ? t("extension.widget.mismatchError")
        .replace("{erpVoen}", mismatch.erpVoen)
        .replace("{portalVoen}", mismatch.portalVoen)
    : null;

  return (
    <div style={shell}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{t("extension.widget.title")}</span>
        <a
          style={{ fontSize: 11, color: "#2563eb" }}
          href="https://erp.example.com"
          target="_blank"
          rel="noreferrer"
        >
          ERP
        </a>
      </div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {debugBadgeEnabled ? (
          <div
            style={{
              borderRadius: 8,
              border: "1px dashed #94a3b8",
              background: "#f1f5f9",
              padding: 8,
              fontSize: 10,
              lineHeight: 1.4,
              color: "#0f172a",
            }}
          >
            <strong>Debug</strong>
            <div>auth: {authState}</div>
            <div>erpVoen: {props.erpActiveOrganization?.taxId ?? "n/a"}</div>
            <div>portalVoen: {portalVoen ?? "null"}</div>
            <div>crossCheck: {mismatch ? "blocked" : "ok"}</div>
          </div>
        ) : null}
        <AwaitAsanStep authState={authState} t={t} />
        {step >= 2 && props.flow !== "customs" ? (
          <AutofillStep
            t={t}
            doc={document}
            flow={props.flow === "eqaime" ? "eqaime" : "emuqavile"}
            blockedReason={blockedReason}
          />
        ) : null}
        {step >= 2 && props.flow === "customs" ? (
          <CaptureBgdStep
            t={t}
            doc={document}
            blockedReason={blockedReason}
            portalVoen={portalVoen}
          />
        ) : null}
        {step >= 3 && props.flow !== "customs" ? <AwaitSignStep t={t} /> : null}
      </div>
      {step < (props.flow === "customs" ? 2 : 3) ? (
        <button
          type="button"
          style={{
            marginTop: 8,
            width: "100%",
            fontSize: 11,
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#fff",
            padding: "6px 8px",
            cursor: "pointer",
          }}
          onClick={() =>
            setStep((s) => {
              const max = props.flow === "customs" ? 2 : 3;
              return s < max ? ((s + 1) as Step) : s;
            })
          }
        >
          Next
        </button>
      ) : null}
    </div>
  );
}
