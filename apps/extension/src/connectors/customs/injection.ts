import { CUSTOMS_SELECTORS } from "./selectors";
import { detectCustomsActiveVoen } from "./auth-detect";
import { sendCustomsBgdCapture } from "./capture-to-erp";
import { getErpOrigin } from "../../shared/local-store";
import { erpOriginDefault } from "../../shared/config";

const BTN_STYLE = [
  "margin-left:8px",
  "padding:6px 12px",
  "border-radius:8px",
  "border:none",
  "background:#2563eb",
  "color:#fff",
  "font-weight:600",
  "font-size:13px",
  "font-family:system-ui,sans-serif",
  "cursor:pointer",
  "box-shadow:0 1px 2px rgba(15,23,42,0.15)",
].join(";");

/**
 * Injects a "ERA Capture" button into the portal action bar (when selector matches).
 */
export function mountCustomsCaptureInjection(): () => void {
  const tryInject = () => {
    const bars = document.querySelectorAll(CUSTOMS_SELECTORS.portalActionBar);
    bars.forEach((bar) => {
      if (bar.querySelector("[data-erafinance-injected-capture]")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-erafinance-injected-capture", "1");
      btn.setAttribute("aria-label", "ERA Capture");
      btn.textContent = "ERA Capture";
      btn.style.cssText = BTN_STYLE;
      btn.addEventListener("click", () => {
        void (async () => {
          const prev = btn.textContent;
          btn.disabled = true;
          btn.textContent = "…";
          try {
            const voen = await detectCustomsActiveVoen(document);
            const data = await sendCustomsBgdCapture(document, voen);
            const origin = (await getErpOrigin()) ?? erpOriginDefault();
            if (data?.id) {
              window.open(`${origin}/customs/${encodeURIComponent(data.id)}`, "_blank", "noopener,noreferrer");
            }
            btn.textContent = data?.deduplicated ? "OK (exists)" : "OK";
            window.setTimeout(() => {
              btn.textContent = prev;
              btn.disabled = false;
            }, 2500);
          } catch (e) {
            btn.textContent = prev ?? "ERA Capture";
            btn.disabled = false;
            window.alert(e instanceof Error ? e.message : String(e));
          }
        })();
      });
      bar.appendChild(btn);
    });
  };

  tryInject();
  const observer = new MutationObserver(() => {
    tryInject();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    document.querySelectorAll("[data-erafinance-injected-capture]").forEach((el) => el.remove());
  };
}
