"use client";

import { useEffect } from "react";

const HANDSHAKE_REQ = "ext-handshake-req";
const HANDSHAKE_OK = "ext-handshake-ok";
const HANDSHAKE_ERR = "ext-handshake-err";

/**
 * Listens for postMessage from ERA Finance Assistant content script; runs same-origin
 * POST /api/auth/extension/refresh so HttpOnly cookies apply (Next rewrites to API).
 */
export function ExtensionBridge() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.__erafinance !== HANDSHAKE_REQ) return;

      const url = "/api/auth/extension/refresh";
      void fetch(url, { method: "POST", credentials: "include" })
        .then(async (r) => {
          const text = await r.text();
          let payload: unknown;
          try {
            payload = JSON.parse(text) as unknown;
          } catch {
            payload = { raw: text || r.statusText };
          }
          if (!r.ok) {
            window.postMessage(
              {
                __erafinance: HANDSHAKE_ERR,
                status: r.status,
                payload,
              },
              window.location.origin,
            );
            return;
          }
          window.postMessage(
            { __erafinance: HANDSHAKE_OK, payload },
            window.location.origin,
          );
        })
        .catch((err: unknown) => {
          window.postMessage(
            {
              __erafinance: HANDSHAKE_ERR,
              message: err instanceof Error ? err.message : String(err),
            },
            window.location.origin,
          );
        });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
