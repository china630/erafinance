import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { sendCustomsBgdCapture } from "../../connectors/customs/capture-to-erp";
import { parseOpenBgdPage } from "../../connectors/customs/flows/bgd-capture";
import { getErpOrigin } from "../../shared/local-store";
import { erpOriginDefault } from "../../shared/config";

const card: CSSProperties = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  padding: 12,
  fontSize: 13,
};

const btn: CSSProperties = {
  marginTop: 8,
  width: "100%",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function CaptureBgdStep(props: {
  t: (k: string) => string;
  doc: Document;
  blockedReason?: string | null;
  portalVoen: string | null;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    try {
      const full = parseOpenBgdPage(props.doc);
      return full.items.slice(0, 8).map((it) => ({
        hs: it.hsCode,
        stat: it.statisticalValueAzn,
      }));
    } catch {
      return [];
    }
  }, [props.doc]);

  const run = async () => {
    setStatus(null);
    if (props.blockedReason) {
      setStatus(props.blockedReason);
      return;
    }
    setBusy(true);
    try {
      const data = await sendCustomsBgdCapture(props.doc, props.portalVoen);
      const origin = (await getErpOrigin()) ?? erpOriginDefault();
      if (data?.id) {
        const url = `${origin}/customs/${encodeURIComponent(data.id)}`;
        const parts: string[] = [];
        parts.push(
          data.deduplicated
            ? props.t("extension.widget.captureDeduped")
            : props.t("extension.widget.captureOk"),
        );
        if (data.mismatchPctDuty != null && data.mismatchPctDuty > 0.5) {
          parts.push(
            props.t("extension.widget.captureMismatchWarn").replace("{pct}", String(data.mismatchPctDuty)),
          );
        }
        if (data.mismatchPctVat != null && data.mismatchPctVat > 0.5) {
          parts.push(
            props.t("extension.widget.captureMismatchWarnVat").replace("{pct}", String(data.mismatchPctVat)),
          );
        }
        setStatus(parts.join(" "));
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setStatus(props.t("extension.widget.captureUnexpected"));
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {props.t("extension.widget.stepCaptureBgd")}
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.4 }}>
        {props.t("extension.widget.captureBgdHint")}
      </p>
      {preview.length > 0 ? (
        <div
          style={{
            marginTop: 8,
            maxHeight: 120,
            overflow: "auto",
            fontSize: 11,
            color: "#334155",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: 6,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {props.t("extension.widget.captureItemsPreview")}
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {preview.map((row, i) => (
              <li key={`${row.hs}-${i}`}>
                HS {row.hs} — {row.stat} AZN
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" style={btn} disabled={busy} onClick={() => void run()}>
        {busy ? "…" : props.t("extension.widget.captureToErp")}
      </button>
      {status ? (
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#0f172a" }}>{status}</p>
      ) : null}
    </div>
  );
}
