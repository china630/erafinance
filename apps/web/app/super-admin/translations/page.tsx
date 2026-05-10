import { redirect } from "next/navigation";

export default function LegacySuperAdminTranslationsRedirectPage() {
  redirect("/super-admin/data/translations");
}
