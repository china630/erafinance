import type { CSSProperties } from "react";
import { OrgSwitcher } from "./OrgSwitcher";

type Org = { id: string; name: string; taxId: string };

const tile: CSSProperties = {
  flex: 1,
  minWidth: 120,
  padding: 12,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
};

export function HubView(props: {
  t: (k: string) => string;
  organizations: Org[];
  activeOrgId: string | null;
  onOrgChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 18 }}>{props.t("extension.hub.title")}</h1>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          {props.t("extension.hub.subtitle")}
        </p>
      </div>
      <OrgSwitcher
        t={props.t}
        organizations={props.organizations}
        activeId={props.activeOrgId}
        onChange={props.onOrgChange}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a style={tile} href="https://emas.sosial.gov.az" target="_blank" rel="noreferrer">
          {props.t("extension.hub.serviceEmas")}
        </a>
        <a style={tile} href="https://e-taxes.gov.az" target="_blank" rel="noreferrer">
          {props.t("extension.hub.serviceEtaxes")}
        </a>
        <a style={tile} href="https://e-customs.gov.az" target="_blank" rel="noreferrer">
          {props.t("extension.hub.serviceCustoms")}
        </a>
      </div>
      <a
        href="https://erp.example.com"
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 12, color: "#2563eb" }}
      >
        {props.t("extension.hub.openErp")}
      </a>
    </div>
  );
}
