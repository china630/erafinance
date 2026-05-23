/** Asia/Baku calendar helpers for billing period keys and invoice month boundaries. */

export const BAKU_TZ = "Asia/Baku";

export function bakuYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/** `YYYY-MM` for the calendar month in Asia/Baku that contains `at`. */
export function billingPeriodKeyBaku(at = new Date()): string {
  const { y, m } = bakuYmd(at);
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Inclusive bounds for a Baku calendar month (`YYYY-MM`). */
export function bakuMonthBounds(periodKey: string): { from: Date; to: Date } {
  const [ys, ms] = periodKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const fromIso = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toIso = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;
  return { from: bakuInstantFromLocalIso(fromIso), to: bakuInstantFromLocalIso(toIso) };
}

/** Previous calendar month key in Baku relative to `at`. */
export function previousBillingPeriodKeyBaku(at = new Date()): string {
  const { y, m } = bakuYmd(at);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${prev.y}-${String(prev.m).padStart(2, "0")}`;
}

function bakuInstantFromLocalIso(localIso: string): Date {
  const utcGuess = new Date(`${localIso}Z`);
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utcGuess);
  const tzName = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "+04";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetMin = 4 * 60;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const h = Number(match[2]);
    const min = Number(match[3] ?? 0);
    offsetMin = sign * (h * 60 + min);
  }
  return new Date(utcGuess.getTime() - offsetMin * 60 * 1000);
}
