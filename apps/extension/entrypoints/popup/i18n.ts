import { getExtensionMergedResources } from "@erafinance/i18n";

export function pickLang(): "ru" | "az" {
  try {
    const u = chrome?.i18n?.getUILanguage?.() ?? "ru";
    return u.toLowerCase().startsWith("az") ? "az" : "ru";
  } catch {
    return "ru";
  }
}

export function makeT(lng: "ru" | "az") {
  const merged = getExtensionMergedResources();
  const tree = merged[lng].translation as Record<string, unknown>;
  return (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = tree;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
}
