"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EarlyAccessModuleKey } from "./modules.config";
import { EarlyAccessLandingModal } from "./early-access-landing-modal";

type EarlyAccessContextValue = {
  open: (moduleKey: EarlyAccessModuleKey) => void;
  close: () => void;
};

const EarlyAccessContext = createContext<EarlyAccessContextValue | null>(null);

export function useEarlyAccess(): EarlyAccessContextValue {
  const v = useContext(EarlyAccessContext);
  if (!v) {
    throw new Error("useEarlyAccess: missing EarlyAccessProvider");
  }
  return v;
}

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
  const [moduleKey, setModuleKey] = useState<EarlyAccessModuleKey | null>(null);

  const open = useCallback((k: EarlyAccessModuleKey) => {
    setModuleKey(k);
  }, []);

  const close = useCallback(() => {
    setModuleKey(null);
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <EarlyAccessContext.Provider value={value}>
      {children}
      {moduleKey ? (
        <EarlyAccessLandingModal moduleKey={moduleKey} onClose={close} />
      ) : null}
    </EarlyAccessContext.Provider>
  );
}
