import type { AuthState } from "../types";
import { EtaxesSelectors } from "./selectors";

function normalizeVoen(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function detectEtaxesAuthState(doc: Document): AuthState {
  for (const sel of EtaxesSelectors.authIndicators) {
    try {
      if (doc.querySelector(sel)) return "authenticated";
    } catch {
      /* invalid selector */
    }
  }
  if (doc.querySelector("form")) return "anonymous";
  return "unknown";
}

export async function detectEtaxesActiveVoen(doc: Document): Promise<string | null> {
  // TODO: refine VOEN selectors against real DVX profile/header DOM.
  for (const sel of EtaxesSelectors.activeVoenCandidates) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const node of nodes) {
      const voen = normalizeVoen((node.textContent ?? "").trim());
      if (voen) return voen;
    }
  }
  return normalizeVoen(doc.body?.innerText ?? "");
}
