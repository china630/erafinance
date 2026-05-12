import { defineContentScript } from "wxt/utils/define-content-script";
import { MSG } from "../src/shared/messages";

const HANDSHAKE_REQ = "ext-handshake-req";
const HANDSHAKE_OK = "ext-handshake-ok";
const HANDSHAKE_ERR = "ext-handshake-err";

export default defineContentScript({
  matches: [
    "https://erp.example.com/*",
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*",
  ],
  runAt: "document_idle",
  main(_ctx) {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== MSG.ERP_HANDSHAKE) return false;

      let settled = false;
      const finish = (payload: unknown) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onWindowMessage);
        window.clearTimeout(timer);
        sendResponse(payload);
      };

      const onWindowMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data?.__erafinance === HANDSHAKE_OK) {
          finish({ ok: true, payload: event.data.payload });
        } else if (event.data?.__erafinance === HANDSHAKE_ERR) {
          finish({ ok: false, error: event.data });
        }
      };

      window.addEventListener("message", onWindowMessage);
      window.postMessage({ __erafinance: HANDSHAKE_REQ }, window.location.origin);

      const timer = window.setTimeout(() => {
        finish({ ok: false, error: "Handshake timeout" });
      }, 12_000);

      return true;
    });
  },
});
