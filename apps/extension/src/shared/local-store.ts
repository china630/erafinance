import { LOCAL_ACTIVE_ORG, LOCAL_ERP_ORIGIN } from "./storage-keys";

export async function getActiveOrganizationId(): Promise<string | null> {
  const v = await browser.storage.local.get(LOCAL_ACTIVE_ORG);
  return (v[LOCAL_ACTIVE_ORG] as string | undefined) ?? null;
}

export async function setActiveOrganizationId(id: string | null): Promise<void> {
  if (id) await browser.storage.local.set({ [LOCAL_ACTIVE_ORG]: id });
  else await browser.storage.local.remove(LOCAL_ACTIVE_ORG);
}

export async function getErpOrigin(): Promise<string | null> {
  const v = await browser.storage.local.get(LOCAL_ERP_ORIGIN);
  return (v[LOCAL_ERP_ORIGIN] as string | undefined) ?? null;
}

export async function setErpOrigin(origin: string): Promise<void> {
  await browser.storage.local.set({ [LOCAL_ERP_ORIGIN]: origin });
}
