"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardWidgets } from "../dashboard-widgets";
import { useAuth, type AuthUser } from "../../lib/auth-context";
import { useRequireAuth } from "../../lib/use-require-auth";

function greetingName(user: AuthUser): string {
  const full = user.fullName?.trim();
  if (full) return full;
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return user.email ?? "";
}

export default function HomeDashboardPage() {
  const { t } = useTranslation();
  useRequireAuth();
  const { token, ready, user } = useAuth();

  const heading = useMemo(() => {
    if (!token || !user) return t("appTitle");
    return t("home.welcomeGreeting", { name: greetingName(user) });
  }, [t, token, user]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#34495E] md:text-3xl">{heading}</h1>
      </div>
      <DashboardWidgets />
    </div>
  );
}
