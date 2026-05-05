"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function severityBorderClass(sev: NotificationRow["severity"]): string {
  switch (sev) {
    case "CRITICAL":
      return "border-l-4 border-destructive";
    case "WARNING":
      return "border-l-4 border-amber-500";
    default:
      return "border-l-4 border-[#2980B9]";
  }
}

function severityTextClass(sev: NotificationRow["severity"]): string {
  switch (sev) {
    case "CRITICAL":
      return "text-destructive";
    case "WARNING":
      return "text-warning";
    default:
      return "text-primary";
  }
}

export function InAppNotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications/unread-count");
      if (!res.ok) return;
      const j = (await res.json()) as { count?: number };
      setUnread(typeof j.count === "number" ? j.count : 0);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        "/api/notifications?page=1&pageSize=15&unreadOnly=false",
      );
      if (!res.ok) {
        setItems([]);
        return;
      }
      const j = (await res.json()) as { items?: NotificationRow[] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 45_000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (open) {
      void loadList();
      void refreshUnread();
    }
  }, [open, loadList, refreshUnread]);

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    void refreshUnread();
    void loadList();
  };

  const markAllRead = async () => {
    await apiFetch("/api/notifications/read-all", { method: "PATCH" });
    void refreshUnread();
    void loadList();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#D5DADF] bg-white text-[#34495E] transition hover:border-[#2980B9]/40 hover:bg-[#2980B9]/10"
          aria-label={t("nav.notificationsBellAria")}
        >
          <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-[120] w-[min(100vw-1.5rem,22rem)] rounded-xl border border-[#D5DADF] bg-white p-0 shadow-xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-[#EBEDF0] px-3 py-2">
            <span className="text-sm font-semibold text-[#34495E]">
              {t("nav.notificationsTitle")}
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-[#2980B9] hover:underline"
              >
                {t("nav.notificationsMarkAll")}
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(70vh,320px)] overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-[#7F8C8D]">
                …
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#7F8C8D]">
                {t("nav.notificationsEmpty")}
              </div>
            ) : (
              <ul className="divide-y divide-[#EBEDF0]">
                {items.map((n) => {
                  const inner = (
                    <>
                      <div
                        className={`text-sm font-semibold ${severityTextClass(n.severity)}`}
                      >
                        {n.title}
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-[#34495E]">
                        {n.message}
                      </p>
                      <div className="mt-1 text-[10px] text-[#7F8C8D]">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </>
                  );
                  const rowClass = `block px-3 py-2.5 text-left transition hover:bg-[#EBEDF0]/60 ${severityBorderClass(n.severity)} ${!n.isRead ? "bg-[#F8F9FA]" : ""}`;
                  if (n.link) {
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.link}
                          className={rowClass}
                          onClick={() => void markRead(n.id)}
                        >
                          {inner}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`${rowClass} w-full`}
                        onClick={() => void markRead(n.id)}
                      >
                        {inner}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Popover.Close className="sr-only">
            {t("nav.notificationsPopoverClose")}
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
