/**
 * Copy for ownership dispute alerts (in-app + email). AZ/RU primary; EN short line for mixed teams.
 * Align with `platform-recovery/dispute/legal-templates/dispute-notice-*.md` for legal wording.
 */

export const OWNERSHIP_DISPUTE_IN_APP_TITLE =
  "Mülkiyyət mübahisəsi / Спор о владении / Ownership dispute";

export function ownershipDisputeInAppMessage(disputeId: string): string {
  return (
    `Təşkilatınız üçün mülkiyyət mübahisəsi açıldı (iş № ${disputeId}). ` +
    `Открыт спор о владении вашей организацией (дело ${disputeId}). ` +
    `An ownership dispute was opened for your organization (case ${disputeId}).`
  );
}

export function ownershipDisputeEmailSubject(): string {
  return "ERA Finance — mülkiyyət mübahisəsi / спор о владении";
}

export function ownershipDisputeEmailBody(disputeUrlPath: string, absoluteAppOrigin: string): string {
  const fullUrl = `${absoluteAppOrigin.replace(/\/$/, "")}${disputeUrlPath.startsWith("/") ? "" : "/"}${disputeUrlPath}`;
  return [
    "(AZ) Təşkilatınız üzrə mülkiyyət mübahisəsi açılıb. Əks-iddia üçün təhlükəsiz keçid:",
    fullUrl,
    "",
    "(RU) Открыт спор о владении. Безопасная ссылка для контр-заявления:",
    fullUrl,
    "",
    "(EN) Ownership dispute opened. Secure link to submit a counter-claim:",
    fullUrl,
    "",
    "ERA Finance",
  ].join("\n");
}
