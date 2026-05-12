import { defineBackground } from "wxt/utils/define-background";
import {
  MSG,
  type PortalBulkPrefillMsg,
  type PortalBulkResultMsg,
  type PortalPrefillMsg,
} from "../src/shared/messages";
import {
  getAuthSnapshot,
  getSubscriptionSnapshot,
  getEmployeePrefill,
  getInvoicePrefill,
  getEmployeesBulkPrefill,
  getInvoicesBulkPrefill,
  logoutExtension,
  reportEmployeesBulkResult,
  reportInvoicesBulkResult,
  postCustomsCapture,
  requestMagicAuth,
  switchOrganization,
} from "../src/background/auth-flow";

export default defineBackground(() => {
  browser.alarms.create("erafinance-keepalive", { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener(() => {
    /* keep service worker alive between long portal sessions */
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void (async () => {
      try {
        if (message?.type === MSG.AUTH_REQUEST_MAGIC) {
          const r = await requestMagicAuth();
          sendResponse({ ok: r.ok, error: r.error });
          return;
        }
        if (message?.type === MSG.AUTH_SNAPSHOT) {
          const data = await getAuthSnapshot();
          sendResponse({ ok: true, data });
          return;
        }
        if (message?.type === MSG.AUTH_SWITCH_ORG) {
          await switchOrganization(message.organizationId as string);
          sendResponse({ ok: true });
          return;
        }
        if (message?.type === MSG.AUTH_LOGOUT) {
          await logoutExtension();
          sendResponse({ ok: true });
          return;
        }
        if (message?.type === MSG.ENTITLEMENTS_GET) {
          const data = await getSubscriptionSnapshot();
          sendResponse({ ok: true, data });
          return;
        }
        if (message?.type === MSG.PORTAL_PREFILL) {
          const req = message as PortalPrefillMsg;
          const flow = req.flow ?? "emuqavile";
          if (flow === "customs") {
            const data = await postCustomsCapture(
              (req as { capture?: unknown }).capture,
            );
            sendResponse({ ok: true, data });
            return;
          }
          const data =
            flow === "eqaime"
              ? await getInvoicePrefill(req.invoiceId)
              : await getEmployeePrefill(req.employeeId);
          sendResponse({ ok: true, data });
          return;
        }
        if (message?.type === MSG.PORTAL_BULK_PREFILL) {
          const req = message as PortalBulkPrefillMsg;
          const flow = req.flow ?? "emuqavile";
          const data =
            flow === "eqaime"
              ? await getInvoicesBulkPrefill(req.invoiceIds)
              : await getEmployeesBulkPrefill(req.employeeIds);
          sendResponse({ ok: true, data });
          return;
        }
        if (message?.type === MSG.PORTAL_BULK_RESULT) {
          const req = message as PortalBulkResultMsg;
          const flow = req.flow ?? "emuqavile";
          const data =
            flow === "eqaime"
              ? await reportInvoicesBulkResult({
                  runId: req.runId,
                  items: req.items,
                })
              : await reportEmployeesBulkResult({
                  runId: req.runId,
                  items: req.items,
                });
          sendResponse({ ok: true, data });
          return;
        }
        sendResponse({ ok: false, error: "Unknown message" });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return true;
  });
});
