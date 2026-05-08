import { SESSION_ACCESS, SESSION_EXPIRES } from "./storage-keys";

export async function getAccessToken(): Promise<string | null> {
  const s = await browser.storage.session.get([SESSION_ACCESS]);
  const t = s[SESSION_ACCESS] as string | undefined;
  const exp = s[SESSION_EXPIRES] as string | undefined;
  if (!t) return null;
  if (exp && Date.now() > new Date(exp).getTime()) {
    await browser.storage.session.remove([SESSION_ACCESS, SESSION_EXPIRES]);
    return null;
  }
  return t;
}

export async function setAccessSession(
  accessToken: string,
  expiresAtIso?: string,
): Promise<void> {
  await browser.storage.session.set({
    [SESSION_ACCESS]: accessToken,
    [SESSION_EXPIRES]: expiresAtIso ?? "",
  });
}

export async function clearAccessSession(): Promise<void> {
  await browser.storage.session.remove([SESSION_ACCESS, SESSION_EXPIRES]);
}
