import { defineContentScript } from "wxt/utils/define-content-script";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { FloatingWidget } from "../src/widget/FloatingWidget";
import { getErpActiveOrganization } from "../src/shared/erp-active-org";

export default defineContentScript({
  matches: ["https://new.e-taxes.gov.az/*", "https://login.e-taxes.gov.az/*"],
  runAt: "document_idle",
  async main(_ctx) {
    const host = document.createElement("div");
    host.id = "erafinance-assistant-host";
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.zIndex = "2147483646";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "closed" });
    const mount = document.createElement("div");
    shadow.appendChild(mount);

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
    `;
    shadow.appendChild(style);

    const erpActiveOrganization = await getErpActiveOrganization().catch(() => null);
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <FloatingWidget erpActiveOrganization={erpActiveOrganization} flow="eqaime" />
      </StrictMode>,
    );
  },
});
