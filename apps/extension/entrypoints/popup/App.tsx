import { useCallback, useEffect, useMemo, useState } from "react";
import { makeT, pickLang } from "./i18n";
import { MSG } from "../../src/shared/messages";
import { matchPortal } from "../../src/connectors/registry";
import { HubView } from "./views/HubView";
import { PortalContextView } from "./views/PortalContextView";

type Org = { id: string; name: string; taxId: string };

type AuthMe = {
  user: { organizationId: string | null };
  organizations: Org[];
};

type SubMe = {
  modules?: { hrFull?: boolean; taxPro?: boolean; tradePro?: boolean };
};

function sendBg<T>(msg: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: { ok?: boolean; data?: T; error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res?.ok) reject(new Error(res?.error ?? "Request failed"));
      else resolve(res.data as T);
    });
  });
}

function sendMagicAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: MSG.AUTH_REQUEST_MAGIC },
      (res: { ok?: boolean; error?: string }) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!res?.ok) reject(new Error(res?.error ?? "Magic auth failed"));
        else resolve();
      },
    );
  });
}

export default function App() {
  const lng = useMemo(() => pickLang(), []);
  const t = useMemo(() => makeT(lng), [lng]);
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [sub, setSub] = useState<SubMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await sendMagicAuth();
      const snap = await sendBg<AuthMe>({ type: MSG.AUTH_SNAPSHOT });
      setAuth(snap);
      try {
        const subRes = await sendBg<SubMe>({ type: MSG.ENTITLEMENTS_GET });
        setSub(subRes);
      } catch {
        setSub(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const loadTab = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const u = tabs[0]?.url ?? null;
        setTabUrl(u);
      });
    };
    loadTab();
    chrome.tabs.onActivated.addListener(loadTab);
    chrome.tabs.onUpdated.addListener(loadTab);
    return () => {
      chrome.tabs.onActivated.removeListener(loadTab);
      chrome.tabs.onUpdated.removeListener(loadTab);
    };
  }, []);

  const portal = tabUrl ? matchPortal(tabUrl) : null;

  if (loading) {
    return <p style={{ padding: 12, fontSize: 13 }}>{t("extension.auth.magicInProgress")}</p>;
  }

  if (error || !auth) {
    return (
      <div style={{ padding: 12, maxWidth: 360 }}>
        <p style={{ color: "#b91c1c", fontSize: 13 }}>{t("extension.auth.error")}</p>
        <p style={{ fontSize: 12, color: "#475569" }}>{error ?? t("extension.auth.needLogin")}</p>
        <button
          type="button"
          style={{ marginTop: 8, fontSize: 12 }}
          onClick={() => void refresh()}
        >
          Retry
        </button>
      </div>
    );
  }

  const activeOrgId = auth.user.organizationId;

  if (portal) {
    return (
      <div style={{ padding: 12, maxWidth: 380 }}>
        <PortalContextView
          t={t}
          connector={portal}
          tabUrl={tabUrl ?? "about:blank"}
          entitlements={{
            hrFull: Boolean(sub?.modules?.hrFull),
            taxPro: Boolean(sub?.modules?.taxPro),
            tradePro: Boolean(sub?.modules?.tradePro),
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, maxWidth: 400 }}>
      <HubView
        t={t}
        organizations={auth.organizations}
        activeOrgId={activeOrgId}
        onOrgChange={() => void refresh()}
      />
    </div>
  );
}
