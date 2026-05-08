/**
 * S3 Object Lock (COMPLIANCE) retention by key prefix — PRD Dispute & Recovery / TZ.
 * Longest matching prefix wins.
 *
 * Legal/compliance: align longest-lived prefixes with counsel; `snapshots/` here is the
 * **object-lock ceiling** on S3, while `OrganizationDataSnapshot.expiresAt` + lifecycle
 * policies should garbage-collect rows/objects per ops (default metadata retention:
 * `SNAPSHOT_RETENTION_DAYS`, see `snapshot.service.ts`).
 */
const PREFIX_RETENTION_DAYS: Array<{ prefix: string; days: number }> = [
  { prefix: "invoices/pdf/", days: 7 * 365 },
  { prefix: "evidence/", days: 7 * 365 },
  { prefix: "attachments/", days: 365 },
  { prefix: "snapshots/", days: 365 },
];

export function objectLockRetainUntilForKey(key: string): Date | undefined {
  let bestPrefix = "";
  let days = 0;
  for (const row of PREFIX_RETENTION_DAYS) {
    if (key.startsWith(row.prefix) && row.prefix.length >= bestPrefix.length) {
      bestPrefix = row.prefix;
      days = row.days;
    }
  }
  if (!bestPrefix || days <= 0) {
    return undefined;
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
