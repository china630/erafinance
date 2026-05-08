import { endOfMonth } from "date-fns";

/**
 * End of the **UTC** calendar month that contains `from`, at 23:59:59.999 UTC.
 * Same boundary as `BillingMonthlyService` (`endOfMonthUtc`) for post-paid periods.
 *
 * Uses `date-fns/endOfMonth` on a mid-month UTC anchor. If the process timezone is not UTC,
 * `endOfMonth` may disagree — then we return the explicit UTC last millisecond (deterministic).
 *
 * **Production:** run the API with `TZ=UTC` (recommended in Docker) so date-fns and billing align.
 */
export function computeNewOrganizationDemoPeriodEndsAt(from: Date = new Date()): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const explicitUtc = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  const anchor = new Date(Date.UTC(y, m, 15, 12, 0, 0, 0));
  const eom = endOfMonth(anchor);
  if (eom.getTime() !== explicitUtc.getTime()) {
    return explicitUtc;
  }
  return eom;
}
