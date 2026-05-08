"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";
import { useAuth } from "../../lib/auth-context";

type TimelineItem =
  | {
      kind: "activity";
      id: string;
      verb: string;
      summary: string | null;
      actorUserId: string | null;
      createdAt: string;
      payload: unknown;
    }
  | {
      kind: "comment";
      id: string;
      body: string;
      authorUserId: string;
      authorEmail: string | null;
      createdAt: string;
      updatedAt: string;
    };

type Props = {
  entityType: string;
  entityId: string;
  canComment?: boolean;
};

export function ActivityPanel({ entityType, entityId, canComment = true }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const myUserId = user?.id ?? null;
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    if (!entityId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch(
      `/api/activity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    );
    if (!res.ok) {
      setItems([]);
      setLoading(false);
      if (res.status !== 404) {
        toast.error(await res.text());
      }
      return;
    }
    const data = (await res.json()) as { items: TimelineItem[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendComment() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const res = await apiFetch(
      `/api/activity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      },
    );
    setSending(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setBody("");
    await load();
  }

  async function saveEdit() {
    if (!editingId) return;
    const text = editBody.trim();
    if (!text) return;
    const res = await apiFetch(`/api/activity/comments/${encodeURIComponent(editingId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setEditingId(null);
    await load();
  }

  async function removeComment(id: string) {
    if (!window.confirm(t("activityStream.delete"))) return;
    const res = await apiFetch(`/api/activity/comments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    await load();
  }

  function verbLabel(verb: string): string {
    switch (verb) {
      case "created":
        return t("activityStream.verbCreated");
      case "updated":
        return t("activityStream.verbUpdated");
      case "deleted":
        return t("activityStream.verbDeleted");
      default:
        return verb;
    }
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#34495E]">{t("activityStream.title")}</h2>
      {loading ? (
        <p className="mt-2 text-xs text-[#7F8C8D]">{t("activityStream.loading")}</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-[#7F8C8D]">{t("activityStream.empty")}</p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto text-xs">
          {items.map((it) => (
            <li
              key={`${it.kind}-${it.id}`}
              className="border-b border-[#F3F4F6] pb-2 last:border-0"
            >
              {it.kind === "activity" ? (
                <div>
                  <div className="font-medium text-[#2C3E50]">
                    {it.summary ?? `${t("activityStream.systemEvent")}: ${verbLabel(it.verb)}`}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#95A5A6]">
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] text-[#7F8C8D]">
                    {it.authorEmail ?? it.authorUserId.slice(0, 8)} ·{" "}
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                  {editingId === it.id ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
                        rows={3}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveEdit()}>
                          {t("activityStream.save")}
                        </button>
                        <button
                          type="button"
                          className={SECONDARY_BUTTON_CLASS}
                          onClick={() => setEditingId(null)}
                        >
                          {t("activityStream.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 whitespace-pre-wrap text-[#34495E]">{it.body}</p>
                      {canComment && myUserId && it.authorUserId === myUserId && (
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-[#3498DB] hover:underline"
                            onClick={() => {
                              setEditingId(it.id);
                              setEditBody(it.body);
                            }}
                          >
                            {t("activityStream.edit")}
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-red-600 hover:underline"
                            onClick={() => void removeComment(it.id)}
                          >
                            {t("activityStream.delete")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="mt-4 space-y-2 border-t border-[#F3F4F6] pt-3">
          <p className="text-[10px] text-[#95A5A6]">{t("activityStream.hintMention")}</p>
          <textarea
            className="w-full rounded border border-[#D1D5DB] p-2 text-xs"
            rows={3}
            placeholder={t("activityStream.placeholder")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={sending || !body.trim()}
            onClick={() => void sendComment()}
          >
            {t("activityStream.send")}
          </button>
        </div>
      )}
    </section>
  );
}
