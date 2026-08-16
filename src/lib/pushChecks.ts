// No "server-only" guard here (see the note in webPush.ts) — this module is
// also imported by worker-entry.ts's scheduled handler, bundled outside
// Next's react-server module graph.
import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { formatPln, monthPeriod } from "@/lib/date";
import { households, monthlyBudgets, pushNotificationLog, pushSubscriptions, recurringExpenses, transactions } from "@/db/schema";
import { sendPushNotification, type PushMessagePayload, type VapidKeys } from "@/lib/webPush";

const REMINDER_DAYS_AHEAD = 3;
const BUDGET_ALERT_RATIO = 0.8;

async function alreadyNotified(db: Db, householdId: string, dedupeKey: string): Promise<boolean> {
  const row = await db
    .select({ id: pushNotificationLog.id })
    .from(pushNotificationLog)
    .where(and(eq(pushNotificationLog.householdId, householdId), eq(pushNotificationLog.dedupeKey, dedupeKey)))
    .get();
  return Boolean(row);
}

async function markNotified(db: Db, householdId: string, dedupeKey: string): Promise<void> {
  await db.insert(pushNotificationLog).values({ householdId, dedupeKey }).onConflictDoNothing();
}

async function notifyHousehold(db: Db, householdId: string, message: PushMessagePayload, vapid: VapidKeys): Promise<void> {
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.householdId, householdId))
    .all();

  for (const subscription of subscriptions) {
    const result = await sendPushNotification(subscription, message, vapid);
    if (result.expired) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
    }
  }
}

/** Checks every household for due recurring payments and near-limit budgets, and pushes a notification for each new one. */
export async function runPushChecks(db: Db, vapid: VapidKeys): Promise<void> {
  const allHouseholds = await db.select({ id: households.id }).from(households).all();

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const reminderCutoff = new Date(today);
  reminderCutoff.setDate(reminderCutoff.getDate() + REMINDER_DAYS_AHEAD);
  const reminderCutoffIso = reminderCutoff.toISOString().slice(0, 10);
  const { periodStart } = monthPeriod(today);

  for (const household of allHouseholds) {
    const dueSoon = await db
      .select()
      .from(recurringExpenses)
      .where(
        and(
          eq(recurringExpenses.householdId, household.id),
          eq(recurringExpenses.active, true),
          gte(recurringExpenses.nextDueDate, todayIso),
          lte(recurringExpenses.nextDueDate, reminderCutoffIso),
        ),
      )
      .all();

    for (const recurring of dueSoon) {
      const dedupeKey = `recurring:${recurring.id}:${recurring.nextDueDate}`;
      if (await alreadyNotified(db, household.id, dedupeKey)) continue;
      await notifyHousehold(
        db,
        household.id,
        {
          title: "Zbliża się płatność",
          body: `${recurring.name} — ${formatPln(recurring.amount)} (${new Date(recurring.nextDueDate).toLocaleDateString("pl-PL")})`,
          url: "/cykliczne",
        },
        vapid,
      );
      await markNotified(db, household.id, dedupeKey);
    }

    const budget = await db
      .select({ limitAmount: monthlyBudgets.limitAmount })
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.householdId, household.id), eq(monthlyBudgets.period, periodStart)))
      .get();
    if (!budget || budget.limitAmount <= 0) continue;

    const spentRows = await db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          eq(transactions.type, "expense"),
          gte(transactions.occurredOn, periodStart),
        ),
      )
      .all();
    const spent = spentRows.reduce((sum, row) => sum + row.amount, 0);
    if (spent / budget.limitAmount < BUDGET_ALERT_RATIO) continue;

    const dedupeKey = `budget:${periodStart}`;
    if (await alreadyNotified(db, household.id, dedupeKey)) continue;
    await notifyHousehold(
      db,
      household.id,
      {
        title: "Budżet miesięczny",
        body: `Wydano już ${Math.round((spent / budget.limitAmount) * 100)}% miesięcznego limitu (${formatPln(spent)} / ${formatPln(budget.limitAmount)}).`,
        url: "/budzet",
      },
      vapid,
    );
    await markNotified(db, household.id, dedupeKey);
  }
}
