import type { CSSProperties } from "react";
import type { AuthState } from "../../connectors/types";

const card: CSSProperties = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: 12,
  fontSize: 13,
};

export function AwaitAsanStep(props: {
  authState: AuthState;
  t: (k: string) => string;
}) {
  return (
    <div style={card}>
      <p style={{ fontWeight: 600, margin: 0 }}>{props.t("extension.widget.stepAsan")}</p>
      <p style={{ marginTop: 8, color: "#475569", marginBottom: 0 }}>
        {props.authState === "authenticated"
          ? props.t("extension.portal.authOk")
          : props.t("extension.portal.authWaiting")}
      </p>
    </div>
  );
}
