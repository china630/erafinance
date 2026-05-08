import type { CSSProperties } from "react";
import { MSG } from "../../../src/shared/messages";

type Org = { id: string; name: string; taxId: string };

export function OrgSwitcher(props: {
  t: (k: string) => string;
  organizations: Org[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    display: "block",
    marginBottom: 4,
  };
  const selStyle: CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 13,
  };

  const change = (id: string) => {
    void new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: MSG.AUTH_SWITCH_ORG, organizationId: id },
        (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!res?.ok) reject(new Error(res?.error ?? "switch failed"));
          else resolve();
        },
      );
    })
      .then(() => props.onChange(id))
      .catch(() => {
        /* toast optional */
      });
  };

  return (
    <div>
      <span style={labelStyle}>{props.t("extension.orgSwitcher.label")}</span>
      <select
        style={selStyle}
        value={activeId ?? ""}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">{props.t("extension.orgSwitcher.placeholder")}</option>
        {props.organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.taxId})
          </option>
        ))}
      </select>
    </div>
  );
}
