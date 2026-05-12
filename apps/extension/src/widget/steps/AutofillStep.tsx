import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import {
  EmployeeContractPrefillSchema,
  type EmployeeContractPrefill,
  InvoicePrefillSchema,
  type InvoicePrefill,
} from "@erafinance/api-contracts";
import { MSG, type PortalBulkResultMsg } from "../../shared/messages";
import { mapPrefillToFields } from "../../connectors/emas/adapters/erp-to-muqavile";
import { mapInvoicePrefillToFields } from "../../connectors/etaxes/adapters/erp-to-eqaime";

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

type EtaxEmasFlow = "eqaime" | "emuqavile";

export function AutofillStep(props: {
  t: (k: string) => string;
  doc: Document;
  flow: EtaxEmasFlow;
  blockedReason?: string | null;
}) {
  const [entityId, setEntityId] = useState("");
  const [bulkIdsRaw, setBulkIdsRaw] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [isRunningBulk, setIsRunningBulk] = useState(false);
  const [isPausedBulk, setIsPausedBulk] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, success: 0, error: 0 });
  const [status, setStatus] = useState<string | null>(null);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const bulkIds = useMemo(
    () =>
      bulkIdsRaw
        .split(/[\n,\s]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    [bulkIdsRaw],
  );

  const run = async () => {
    setStatus(null);
    if (props.blockedReason) {
      setStatus(props.blockedReason);
      return;
    }
    if (!entityId.trim()) {
      setStatus(props.flow === "eqaime" ? "invoiceId required" : "employeeId required");
      return;
    }
    const raw = await new Promise<unknown>((resolve, reject) => {
      const message =
        props.flow === "eqaime"
          ? { type: MSG.PORTAL_PREFILL, flow: "eqaime" as const, invoiceId: entityId.trim() }
          : { type: MSG.PORTAL_PREFILL, flow: "emuqavile" as const, employeeId: entityId.trim() };
      chrome.runtime.sendMessage(
        message,
        (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!res?.ok) reject(new Error(res?.error ?? "prefill failed"));
          else resolve(res.data);
        },
      );
    });
    const applied =
      props.flow === "eqaime"
        ? mapInvoicePrefillToFields(InvoicePrefillSchema.parse(raw) as InvoicePrefill, props.doc)
            .applied
        : mapPrefillToFields(
            EmployeeContractPrefillSchema.parse(raw) as EmployeeContractPrefill,
            props.doc,
          ).applied;
    for (const el of applied) {
      el.style.outline = "2px solid #22c55e";
      window.setTimeout(() => {
        el.style.outline = "";
      }, 1500);
    }
    setStatus(`Filled ${applied.length} field(s)`);
  };

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const applyOne = async (flow: EtaxEmasFlow, id: string): Promise<number> => {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const message =
        flow === "eqaime"
          ? { type: MSG.PORTAL_PREFILL, flow: "eqaime" as const, invoiceId: id }
          : { type: MSG.PORTAL_PREFILL, flow: "emuqavile" as const, employeeId: id };
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!res?.ok) reject(new Error(res?.error ?? "prefill failed"));
        else resolve(res.data);
      });
    });
    const applied =
      flow === "eqaime"
        ? mapInvoicePrefillToFields(InvoicePrefillSchema.parse(raw) as InvoicePrefill, props.doc).applied
        : mapPrefillToFields(
            EmployeeContractPrefillSchema.parse(raw) as EmployeeContractPrefill,
            props.doc,
          ).applied;
    for (const el of applied) {
      el.style.outline = "2px solid #22c55e";
      window.setTimeout(() => {
        el.style.outline = "";
      }, 1200);
    }
    return applied.length;
  };

  const runBulk = async () => {
    setStatus(null);
    if (props.blockedReason) {
      setStatus(props.blockedReason);
      return;
    }
    if (bulkIds.length === 0) {
      setStatus(props.flow === "eqaime" ? "invoiceIds required" : "employeeIds required");
      return;
    }
    setIsRunningBulk(true);
    setIsPausedBulk(false);
    pauseRef.current = false;
    cancelRef.current = false;
    setProgress({ done: 0, total: bulkIds.length, success: 0, error: 0 });
    const runId = crypto.randomUUID();
    const results: Array<{
      invoiceId?: string;
      employeeId?: string;
      status: "SYNCED" | "ERROR";
      error?: string | null;
    }> = [];
    let consecutiveErrors = 0;

    try {
      for (let i = 0; i < bulkIds.length; i += 1) {
        if (cancelRef.current) break;
        while (pauseRef.current) {
          await sleep(400);
          if (cancelRef.current) break;
        }
        if (cancelRef.current) break;
        const id = bulkIds[i];
        try {
          await applyOne(props.flow, id);
          consecutiveErrors = 0;
          results.push(
            props.flow === "eqaime"
              ? { invoiceId: id, status: "SYNCED" }
              : { employeeId: id, status: "SYNCED" },
          );
          setProgress((p) => ({ ...p, done: p.done + 1, success: p.success + 1 }));
        } catch (e) {
          consecutiveErrors += 1;
          results.push(
            props.flow === "eqaime"
              ? { invoiceId: id, status: "ERROR", error: e instanceof Error ? e.message : String(e) }
              : { employeeId: id, status: "ERROR", error: e instanceof Error ? e.message : String(e) },
          );
          setProgress((p) => ({ ...p, done: p.done + 1, error: p.error + 1 }));
          if (consecutiveErrors >= 3) {
            setStatus("Bulk paused by circuit breaker (3 consecutive errors)");
            pauseRef.current = true;
            setIsPausedBulk(true);
          }
        }
        // Throttle + jitter between requests to reduce risk on state portals.
        await sleep(4000 + Math.floor(Math.random() * 3000));
      }

      const bulkResultMessage: PortalBulkResultMsg =
        props.flow === "eqaime"
          ? {
              type: MSG.PORTAL_BULK_RESULT,
              flow: "eqaime",
              runId,
              items: results.map((it) => ({
                invoiceId: it.invoiceId ?? "",
                status: it.status,
                error: it.error ?? null,
              })),
            }
          : {
              type: MSG.PORTAL_BULK_RESULT,
              flow: "emuqavile",
              runId,
              items: results.map((it) => ({
                employeeId: it.employeeId ?? "",
                status: it.status,
                error: it.error ?? null,
              })),
            };
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(bulkResultMessage, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!res?.ok) {
            reject(new Error(res?.error ?? "bulk result failed"));
            return;
          }
          resolve();
        });
      });
      setStatus(
        `Bulk done: ${results.filter((r) => r.status === "SYNCED").length} ok, ${results.filter((r) => r.status === "ERROR").length} failed`,
      );
    } finally {
      setIsRunningBulk(false);
      setIsPausedBulk(false);
      pauseRef.current = false;
      cancelRef.current = false;
    }
  };

  return (
    <div style={card}>
      <p style={{ fontWeight: 600, margin: 0 }}>
        {props.flow === "eqaime"
          ? props.t("extension.widget.stepFillInvoice")
          : props.t("extension.widget.stepFill")}
      </p>
      <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "#64748b" }}>
        {props.flow === "eqaime"
          ? props.t("extension.widget.selectInvoice")
          : props.t("extension.widget.selectEmployee")}
        <input
          style={{
            marginTop: 4,
            width: "100%",
            borderRadius: 4,
            border: "1px solid #cbd5e1",
            padding: "6px 8px",
            fontSize: 13,
          }}
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="UUID"
        />
      </label>
      <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "#64748b" }}>
        <input
          type="checkbox"
          checked={bulkMode}
          onChange={(e) => setBulkMode(e.target.checked)}
          style={{ marginRight: 6 }}
        />
        Bulk mode
      </label>
      {bulkMode ? (
        <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "#64748b" }}>
          IDs (comma/newline separated)
          <textarea
            style={{
              marginTop: 4,
              width: "100%",
              borderRadius: 4,
              border: "1px solid #cbd5e1",
              padding: "6px 8px",
              fontSize: 12,
              minHeight: 84,
              resize: "vertical",
            }}
            value={bulkIdsRaw}
            onChange={(e) => setBulkIdsRaw(e.target.value)}
            placeholder="uuid-1, uuid-2"
          />
        </label>
      ) : null}
      <button
        type="button"
        style={{
          ...btn,
          cursor: props.blockedReason ? "not-allowed" : "pointer",
          opacity: props.blockedReason ? 0.6 : 1,
        }}
        disabled={Boolean(props.blockedReason)}
        onClick={() => void (bulkMode ? runBulk() : run())}
      >
        {bulkMode
          ? "Run bulk"
          : props.flow === "eqaime"
          ? props.t("extension.widget.fillButtonInvoice")
          : props.t("extension.widget.fillButton")}
      </button>
      {bulkMode ? (
        <div style={{ marginTop: 8, fontSize: 11, color: "#334155" }}>
          Progress: {progress.done}/{progress.total} | ok: {progress.success} | err: {progress.error}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              type="button"
              style={{ ...btn, marginTop: 0, background: "#64748b", padding: "6px 8px", width: "auto" }}
              disabled={!isRunningBulk}
              onClick={() => {
                pauseRef.current = !pauseRef.current;
                setIsPausedBulk(pauseRef.current);
              }}
            >
              {isPausedBulk ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              style={{ ...btn, marginTop: 0, background: "#b91c1c", padding: "6px 8px", width: "auto" }}
              disabled={!isRunningBulk}
              onClick={() => {
                cancelRef.current = true;
                setStatus("Bulk cancelled");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {props.blockedReason ? (
        <p style={{ marginTop: 8, fontSize: 11, color: "#b91c1c", marginBottom: 0 }}>
          {props.blockedReason}
        </p>
      ) : null}
      {status ? (
        <p style={{ marginTop: 8, fontSize: 11, color: "#334155", marginBottom: 0 }}>{status}</p>
      ) : null}
    </div>
  );
}
