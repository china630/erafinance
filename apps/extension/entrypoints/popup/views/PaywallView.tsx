import type { CSSProperties } from "react";

const box: CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fef2f2",
};

export function PaywallView(props: { t: (k: string) => string }) {
  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>{props.t("extension.paywall.title")}</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569" }}>
        {props.t("extension.paywall.body")}
      </p>
      <a
        href="https://erp.example.com/settings/subscription"
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          fontSize: 13,
          fontWeight: 600,
          color: "#2563eb",
        }}
      >
        {props.t("extension.paywall.cta")}
      </a>
    </div>
  );
}
