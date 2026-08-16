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

/** Returns the last `count` month keys (YYYY-MM) ending at the current month, oldest first. */
export function lastMonthKeys(count: number, date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pl-PL", { month: "short" });
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
