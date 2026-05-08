"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";

type Meta = { status: string; organizationName: string };

export default function PublicDisputePage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? "";
  const token = search?.get("t") ?? "";
  const [meta, setMeta] = useState<Meta | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/public/disputes/${encodeURIComponent(id)}/meta?t=${encodeURIComponent(token)}`);
        const j = (await res.json()) as Meta;
        if (!cancelled && res.ok) {
          setMeta(j);
        }
      } catch {
        if (!cancelled) {
          setErr(t("disputePublic.err"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token, t]);

  async function submit() {
    setErr(null);
    setOk(null);
    const res = await apiFetch(`/api/public/disputes/${encodeURIComponent(id)}/counter-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, note }),
    });
    if (!res.ok) {
      setErr(t("disputePublic.err"));
      return;
    }
    setOk(t("disputePublic.ok"));
  }

  return (
    <main style={{ maxWidth: 560, margin: "48px auto", padding: 16 }}>
      <h1>{t("disputePublic.title")}</h1>
      <p style={{ color: "#555" }}>{t("disputePublic.intro")}</p>
      {!token ? <p style={{ color: "crimson" }}>Missing token (t=…)</p> : null}
      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
      {ok ? <p style={{ color: "green" }}>{ok}</p> : null}
      {token && !meta && !err ? <p>{t("disputePublic.loading")}</p> : null}
      {meta ? (
        <div style={{ marginBottom: 16 }}>
          <p>
            <strong>{t("disputePublic.orgLabel")}:</strong> {meta.organizationName}
          </p>
          <p>
            <strong>{t("disputePublic.statusLabel")}:</strong> {meta.status}
          </p>
        </div>
      ) : null}
      {token ? (
        <label style={{ display: "block", marginBottom: 12 }}>
          <div>{t("disputePublic.noteLabel")}</div>
          <textarea
            style={{ width: "100%", minHeight: 120 }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      ) : null}
      {token ? (
        <button type="button" onClick={() => void submit()} disabled={note.trim().length < 3}>
          {t("disputePublic.submit")}
        </button>
      ) : null}
    </main>
  );
}
