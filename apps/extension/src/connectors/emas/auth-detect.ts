import { EmasSelectors } from "./selectors";
import type { AuthState } from "../types";

export function detectEmasAuthState(doc: Document): AuthState {
  const text = doc.body?.innerText?.toLowerCase() ?? "";
  if (text.includes("asan") && text.includes("imza")) {
    /* likely login / signing page */
  }
  for (const sel of EmasSelectors.authIndicators) {
    try {
      if (doc.querySelector(sel)) return "authenticated";
    } catch {
      /* invalid selector */
    }
  }
  if (doc.querySelector("form")) return "anonymous";
  return "unknown";
}

function normalizeVoen(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

export async function detectEmasActiveVoen(doc: Document): Promise<string | null> {
  for (const sel of EmasSelectors.activeVoenCandidates) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const node of nodes) {
      const text = (node.textContent ?? "").trim();
      const voen = normalizeVoen(text);
      if (voen) return voen;
    }
  }
  const bodyVoen = normalizeVoen(doc.body?.innerText ?? "");
  return bodyVoen;
}
