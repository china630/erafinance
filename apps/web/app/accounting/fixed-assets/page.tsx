import { redirect } from "next/navigation";

/** Legacy alias — canonical UI is `/fixed-assets`. */
export default function AccountingFixedAssetsAliasPage() {
  redirect("/fixed-assets");
}
