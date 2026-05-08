import type { PortalConnector } from "./types";
import { customsConnector } from "./customs";
import { emasConnector } from "./emas";
import { etaxesConnector } from "./etaxes";

const all: PortalConnector[] = [emasConnector, etaxesConnector, customsConnector];

export function matchPortal(url: string | URL): PortalConnector | null {
  const u = typeof url === "string" ? new URL(url) : url;
  for (const c of all) {
    if (c.matches(u)) return c;
  }
  return null;
}
