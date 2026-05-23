"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./api-client";
import { useAuth } from "./auth-context";

export type SubscriptionTier = "TIER_1" | "TIER_2" | "TIER_3";

export type SubscriptionSnapshot = {
  tier: SubscriptionTier;
  activeModules: string[];
  /** v8.1 конструктор: { modules: string[], preset?, quotas? } */
  customConfig?: unknown | null;
  modules: {
    manufacturing: boolean;
    fixedAssets: boolean;
    ifrsMapping: boolean;
    bankingPro: boolean;
    hrFull: boolean;
    taxPro: boolean;
    tradePro: boolean;
    auditHub: boolean;
    compliancePro: boolean;
    industryRetailEcom?: boolean;
    industryLogisticsCustoms?: boolean;
    industryConstruction?: boolean;
    industryCrmWhatsapp?: boolean;
  };
  quotas: {
    employees: {
      current: number;
      max: number | null;
      atLimit: boolean;
    };
    invoicesThisMonth: {
      current: number;
      max: number | null;
      atLimit: boolean;
    };
    storage: {
      currentBytes: string;
      maxGb: number | null;
      atLimit: boolean;
    };
    /** Prepaid outbound WhatsApp (Business API) — remaining sends (PRD §6.8). */
    whatsappOutbound: {
      balance: number;
      atLimit: boolean;
    };
  };
  expiresAt: string | null;
  isTrial: boolean;
  billingStatus?: "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";
  /** Истёк оплаченный/демо-период (expiresAt < now) — только чтение в API. */
  readOnly: boolean;
  /** Оставшихся полных дней демо; null если не trial или срок истёк. */
  trialDaysLeft: number | null;
};

const CACHE_KEY = "erafinance_subscription_cache_v1";

function coerceSubscriptionSnapshot(
  s: SubscriptionSnapshot | null,
): SubscriptionSnapshot | null {
  if (!s) return null;
  const w = s.quotas.whatsappOutbound;
  const modules = {
    ...s.modules,
    compliancePro: s.modules.compliancePro ?? false,
    industryRetailEcom: s.modules.industryRetailEcom ?? false,
    industryLogisticsCustoms: s.modules.industryLogisticsCustoms ?? false,
    industryConstruction: s.modules.industryConstruction ?? false,
    industryCrmWhatsapp: s.modules.industryCrmWhatsapp ?? false,
  };
  const base: SubscriptionSnapshot = { ...s, modules };
  if (
    w &&
    typeof w.balance === "number" &&
    typeof w.atLimit === "boolean"
  ) {
    return base;
  }
  return {
    ...base,
    quotas: {
      ...base.quotas,
      whatsappOutbound: { balance: 0, atLimit: true },
    },
  };
}

/** Dev / support: full module access on the client when API returns 403 for subscription. */
const FRONTEND_SUBSCRIPTION_BYPASS_EMAILS = new Set([
  "shirinov.chingiz@gmail.com",
]);

function enterpriseBypassSnapshot(): SubscriptionSnapshot {
  return {
    tier: "TIER_3",
    activeModules: [
      "production",
      "manufacturing",
      "fixed_assets",
      "ifrs",
      "cash_bank_pro",
      "hr_full",
      "tax_pro",
      "trade_pro",
      "audit_hub",
      "compliance_pro",
    ],
    customConfig: null,
    modules: {
      manufacturing: true,
      fixedAssets: true,
      ifrsMapping: true,
      bankingPro: true,
      hrFull: true,
      taxPro: true,
      tradePro: true,
      auditHub: true,
      compliancePro: true,
    },
    quotas: {
      employees: { current: 0, max: null, atLimit: false },
      invoicesThisMonth: { current: 0, max: null, atLimit: false },
      storage: { currentBytes: "0", maxGb: null, atLimit: false },
      whatsappOutbound: { balance: 1_000_000, atLimit: false },
    },
    expiresAt: null,
    isTrial: false,
    billingStatus: "ACTIVE",
    readOnly: false,
    trialDaysLeft: null,
  };
}

function readCachedSnapshot(orgId: string | null): SubscriptionSnapshot | null {
  if (typeof window === "undefined" || !orgId) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      organizationId: string;
      snapshot: SubscriptionSnapshot;
    };
    if (parsed.organizationId !== orgId) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(
  orgId: string | null,
  snap: SubscriptionSnapshot | null,
): void {
  if (typeof window === "undefined" || !orgId) return;
  try {
    if (!snap) {
      const prev = sessionStorage.getItem(CACHE_KEY);
      if (prev) {
        const p = JSON.parse(prev) as { organizationId?: string };
        if (p.organizationId === orgId) sessionStorage.removeItem(CACHE_KEY);
      }
      return;
    }
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ organizationId: orgId, snapshot: snap }),
    );
  } catch {
    /* ignore quota */
  }
}

export type PaywallModuleKey =
  | "manufacturing"
  | "fixedAssets"
  | "ifrsMapping"
  | "bankingPro"
  | "kassaPro";

/**
 * Доступ к модулю по снимку подписки.
 * ENTERPRISE: полный доступ (в т.ч. kassaPro).
 */
export function hasSubscriptionModuleAccess(
  snap: SubscriptionSnapshot | null,
  module: PaywallModuleKey,
  userEmail?: string | null,
): boolean {
  const em = userEmail?.trim().toLowerCase();
  if (em && FRONTEND_SUBSCRIPTION_BYPASS_EMAILS.has(em)) {
    return true;
  }
  if (!snap) return false;
  if (snap.tier === "TIER_3") return true;
  switch (module) {
    case "manufacturing":
      return snap.modules.manufacturing;
    case "fixedAssets":
      return snap.modules.fixedAssets;
    case "ifrsMapping":
      return snap.modules.ifrsMapping;
    case "bankingPro":
    case "kassaPro":
      return snap.modules.bankingPro;
    default:
      return false;
  }
}

type SubscriptionContextValue = {
  /** Auth готов и при наличии токена — загружен снимок подписки (или зафиксирована ошибка). */
  ready: boolean;
  snapshot: SubscriptionSnapshot | null;
  /**
   * Последний успешный снимок для текущей org (при сбое /subscription/me).
   * Использовать вместе с `effectiveSnapshot`.
   */
  snapshotStale: SubscriptionSnapshot | null;
  /** Снимок для гейтов: свежий или закэшированный при ошибке сети. */
  effectiveSnapshot: SubscriptionSnapshot | null;
  fetchError: boolean;
  refetch: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

async function fetchSubscriptionMeWithRetry(
  maxAttempts = 3,
): Promise<{ ok: true; data: SubscriptionSnapshot } | { ok: false }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    try {
      const res = await apiFetch("/api/subscription/me");
      if (res.ok) {
        const data = (await res.json()) as SubscriptionSnapshot;
        return { ok: true, data };
      }
    } catch {
      /* сеть / CORS / обрыв */
    }
  }
  return { ok: false };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, token, organizationId, user } = useAuth();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [snapshotStale, setSnapshotStale] = useState<SubscriptionSnapshot | null>(
    () => readCachedSnapshot(null),
  );
  const [fetchError, setFetchError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (organizationId) {
      const cached = readCachedSnapshot(organizationId);
      setSnapshotStale(cached);
    } else {
      setSnapshotStale(null);
    }
  }, [organizationId]);

  const refetch = useCallback(async () => {
    if (!token) {
      setSnapshot(null);
      setFetchError(false);
      setLoaded(true);
      return;
    }
    setFetchError(false);
    try {
      const result = await fetchSubscriptionMeWithRetry(3);
      if (!result.ok) {
        setSnapshot(null);
        setFetchError(true);
        setLoaded(true);
        return;
      }
      setSnapshot(result.data);
      writeCachedSnapshot(organizationId, result.data);
      setSnapshotStale(result.data);
      setFetchError(false);
      setLoaded(true);
    } catch {
      setSnapshot(null);
      setFetchError(true);
      setLoaded(true);
    }
  }, [token, organizationId]);

  useEffect(() => {
    if (!authReady) return;
    if (!token) {
      void refetch();
      return;
    }
    if (!organizationId) {
      setSnapshot(null);
      setFetchError(false);
      setLoaded(true);
      return;
    }
    void refetch();
  }, [authReady, token, organizationId, refetch]);

  const effectiveSnapshot = useMemo(() => {
    const base = coerceSubscriptionSnapshot(snapshot ?? snapshotStale);
    const email = user?.email?.trim().toLowerCase();
    if (email && FRONTEND_SUBSCRIPTION_BYPASS_EMAILS.has(email)) {
      return enterpriseBypassSnapshot();
    }
    return base;
  }, [snapshot, snapshotStale, user?.email]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      ready: authReady && loaded,
      snapshot,
      snapshotStale,
      effectiveSnapshot,
      fetchError,
      refetch,
    }),
    [
      authReady,
      loaded,
      snapshot,
      snapshotStale,
      effectiveSnapshot,
      fetchError,
      refetch,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
