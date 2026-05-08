import type { PortalConnector } from "../../../src/connectors/types";
import { PaywallView } from "./PaywallView";

export function PortalContextView(props: {
  t: (k: string) => string;
  connector: PortalConnector;
  tabUrl: string;
  entitlements: {
    hrFull: boolean;
    taxPro: boolean;
    tradePro: boolean;
  };
}) {
  const flows = props.connector.listFlows(new URL(props.tabUrl));
  const entitlementToFlag: Partial<Record<PortalConnector["entitlement"], boolean>> = {
    hr_full: props.entitlements.hrFull,
    tax_pro: props.entitlements.taxPro,
    trade_pro: props.entitlements.tradePro,
  };
  const isEnabled = entitlementToFlag[props.connector.entitlement];

  if (isEnabled === false) {
    return <PaywallView t={props.t} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{props.t("extension.portal.contextTitle")}</h2>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{props.connector.id}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {flows.map((f) => (
          <li key={f.id}>{props.t(f.titleKey)}</li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
        {props.t("extension.portal.openWidget")}
      </p>
    </div>
  );
}
