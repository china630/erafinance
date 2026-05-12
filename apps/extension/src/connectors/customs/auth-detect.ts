import type { AuthState } from "../types";

/** Heuristic: authenticated if typical session markers exist (TODO: refine with pilot DOM). */
export function detectCustomsAuthState(doc: Document): AuthState {
  const body = doc.body?.innerText ?? "";
  if (body.includes("ASAN") || body.includes("Çıxış") || body.includes("Çıx")) {
    return "authenticated";
  }
  if (doc.querySelector("a[href*='logout'], button[onclick*='logout']")) {
    return "authenticated";
  }
  if (doc.cookie.length > 20) {
    return "unknown";
  }
  return "anonymous";
}

/** Active VÖEN on portal session — TODO: replace with real selector from e-customs header. */
export async function detectCustomsActiveVoen(doc: Document): Promise<string | null> {
  const el =
    doc.querySelector("[data-erafinance-active-voen]") ??
    doc.querySelector("meta[name='erafinance-active-voen']");
  const fromAttr = el?.getAttribute("content") ?? el?.textContent ?? "";
  const trimmed = fromAttr.replace(/\D/g, "").slice(0, 10);
  if (trimmed.length === 10) return trimmed;
  return null;
}
