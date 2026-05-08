"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../../../lib/api-client";

type SnapshotRow = {
  id: string;
  reason: string;
  takenAt: string;
  sha256: string;
  sizeBytes: string;
};

type SecurityState = {
  mode: string;
  lockUntil: string | null;
  activeDisputeId: string | null;
};

type DisputeRow = {
  id: string;
  status: string;
  severity: string;
  claimantUserId: string;
  incumbentUserId: string;
  createdAt: string;
};

export default function SuperAdminOrgSecurityPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const orgId = params?.id ?? "";
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [stepToken, setStepToken] = useState("");
  const [claimantId, setClaimantId] = useState("");
  const [incumbentId, setIncumbentId] = useState("");
  const [severity, setSeverity] = useState("SOFT");

  const load = useCallback(async () => {
    if (!orgId) {
      return;
    }
    const [sRes, stRes, dRes] = await Promise.all([
      apiFetch(`/api/admin/organizations/${orgId}/snapshots`),
      apiFetch(`/api/admin/organizations/${orgId}/security-state`),
      apiFetch(`/api/admin/organizations/${orgId}/disputes`),
    ]);
    if (!sRes.ok || !stRes.ok || !dRes.ok) {
      throw new Error(`HTTP ${sRes.status} / ${stRes.status} / ${dRes.status}`);
    }
    const sJson = (await sRes.json()) as SnapshotRow[];
    const stJson = (await stRes.json()) as SecurityState | null;
    const dJson = (await dRes.json()) as DisputeRow[];
    setSnapshots(Array.isArray(sJson) ? sJson : []);
    setSecurity(stJson);
    setDisputes(Array.isArray(dJson) ? dJson : []);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, load]);

  async function takeSnapshot() {
    setErr(null);
    const headers: Record<string, string> = {};
    if (stepToken.trim()) {
      headers["X-StepUp-Token"] = stepToken.trim();
    }
    const res = await apiFetch(`/api/admin/organizations/${orgId}/snapshots/manual`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const txt = await res.text();
      setErr(`Snapshot failed: ${res.status} ${txt.slice(0, 200)}`);
      return;
    }
    const row = (await res.json()) as { id: string };
    setSnapshots((prev) => [
      {
        id: row.id,
        reason: "manual",
        takenAt: new Date().toISOString(),
        sha256: "…",
        sizeBytes: "0",
      },
      ...prev,
    ]);
  }

  async function openDispute() {
    setErr(null);
    if (!claimantId || !incumbentId) {
      setErr("claimant and incumbent UUIDs required");
      return;
    }
    const res = await apiFetch(`/api/admin/organizations/${orgId}/disputes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimantUserId: claimantId,
        incumbentUserId: incumbentId,
        evidenceKeys: [],
        severity,
      }),
    });
    if (!res.ok) {
      setErr(`Open dispute failed: ${res.status}`);
      return;
    }
    await load();
  }

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: 16 }}>
      <h1>{t("superAdmin.securityPageTitle")}</h1>
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

      <section style={{ marginBottom: 24 }}>
        <h2>{t("superAdmin.securityModeCard")}</h2>
        {security ? (
          <pre style={{ background: "#f6f6f6", padding: 12 }}>
            {JSON.stringify(security, null, 2)}
          </pre>
        ) : (
          <p>{t("superAdmin.securityLoading")}</p>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>{t("superAdmin.securityDisputesCard")}</h2>
        <button type="button" onClick={() => void load()}>
          {t("superAdmin.securityDisputesRefresh")}
        </button>
        <div style={{ marginTop: 12, display: "grid", gap: 8, maxWidth: 480 }}>
          <input
            placeholder="claimantUserId (uuid)"
            value={claimantId}
            onChange={(e) => setClaimantId(e.target.value)}
            style={{ padding: 8 }}
          />
          <input
            placeholder="incumbentUserId (uuid)"
            value={incumbentId}
            onChange={(e) => setIncumbentId(e.target.value)}
            style={{ padding: 8 }}
          />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="SOFT">SOFT</option>
            <option value="HARD">HARD</option>
          </select>
          <button type="button" onClick={() => void openDispute()}>
            {t("superAdmin.securityOpenDispute")}
          </button>
        </div>
        {disputes.length === 0 ? (
          <p>{t("superAdmin.securityDisputesEmpty")}</p>
        ) : (
          <ul>
            {disputes.map((d) => (
              <li key={d.id}>
                <code>{d.id}</code> — {d.status} / {d.severity}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>{t("superAdmin.securitySnapshotsCard")}</h2>
        <p style={{ fontSize: 13, color: "#555" }}>{t("superAdmin.securityStepUpSnapshotHint")}</p>
        <input
          placeholder="X-StepUp-Token (after OTP verify)"
          value={stepToken}
          onChange={(e) => setStepToken(e.target.value)}
          style={{ width: "100%", maxWidth: 560, padding: 8, marginBottom: 8 }}
        />
        <button type="button" onClick={() => void takeSnapshot()}>
          {t("superAdmin.securityTakeSnapshot")}
        </button>
        {snapshots.length === 0 ? (
          <p>{t("superAdmin.securitySnapshotsEmpty")}</p>
        ) : (
          <ul>
            {snapshots.map((s) => (
              <li key={s.id}>
                {s.reason} — {new Date(s.takenAt).toLocaleString()} —{" "}
                <code>{s.sha256.slice(0, 12)}…</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>{t("superAdmin.securityTimeTravelCard")}</h2>
        <p style={{ color: "#666" }}>Preview: GET /api/admin/organizations/:id/snapshots/:snapshotId/preview-restore</p>
      </section>
    </main>
  );
}
