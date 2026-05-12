import { AuthSnapshotSchema, type OrgSummary } from "@erafinance/api-contracts";
import { MSG } from "./messages";

export async function getErpActiveOrganization(): Promise<OrgSummary | null> {
  const raw = await new Promise<unknown>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: MSG.AUTH_SNAPSHOT }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res?.ok) {
        reject(new Error(res?.error ?? "auth snapshot failed"));
        return;
      }
      resolve(res.data);
    });
  });
  const snapshot = AuthSnapshotSchema.parse(raw);
  if (!snapshot.user.organizationId) return null;
  return snapshot.organizations.find((org) => org.id === snapshot.user.organizationId) ?? null;
}
