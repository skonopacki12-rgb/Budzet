export function monthPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    daysInMonth: end.getUTCDate(),
    dayOfMonth: date.getDate(),
  };
}

export function formatPln(amount: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
}

export type RecurringCycle = "monthly" | "quarterly" | "yearly" | "custom_days";

/** Returns the next due date (YYYY-MM-DD) after `dateIso` for the given billing cycle. */
export function addCycle(dateIso: string, cycle: RecurringCycle, customDays?: number | null): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));

  switch (cycle) {
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    case "custom_days":
      next.setUTCDate(next.getUTCDate() + (customDays && customDays > 0 ? customDays : 30));
      break;
  }

  return next.toISOString().slice(0, 10);
}
