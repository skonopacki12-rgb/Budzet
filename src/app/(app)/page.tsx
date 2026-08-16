import Link from "next/link";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod, formatPln } from "@/lib/date";
import { transactionLabel } from "@/lib/transactions";
import { categories, monthlyBudgets, recurringExpenses, transactions } from "@/db/schema";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) return null;

  const { periodStart, periodEnd, daysInMonth, dayOfMonth } = monthPeriod();

  const [monthlyBudget, txRows, categoryRows, dueRecurring] = await Promise.all([
    db
      .select({ limitAmount: monthlyBudgets.limitAmount })
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.householdId, household.id), eq(monthlyBudgets.period, periodStart)))
      .get(),
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
        shop: transactions.shop,
        note: transactions.note,
        receiptId: transactions.receiptId,
        occurredOn: transactions.occurredOn,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          eq(transactions.type, "expense"),
          gte(transactions.occurredOn, periodStart),
          lte(transactions.occurredOn, periodEnd),
        ),
      )
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .all(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select({ id: recurringExpenses.id, name: recurringExpenses.name, amount: recurringExpenses.amount, nextDueDate: recurringExpenses.nextDueDate })
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.householdId, household.id), eq(recurringExpenses.active, true)))
      .orderBy(asc(recurringExpenses.nextDueDate))
      .all(),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));

  const totalSpent = txRows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const globalBudget = monthlyBudget?.limitAmount ?? null;

  const spentByCategory = new Map<string, number>();
  for (const transaction of txRows) {
    const key = transaction.categoryId ?? "inne";
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + transaction.amount);
  }
  const topCategories = [...spentByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, spent]) => ({ category: categoryById.get(categoryId), spent }));
  const maxCategorySpent = topCategories[0]?.spent ?? 0;

  const projected = dayOfMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : totalSpent;
  const forecastDiff = globalBudget != null ? projected - globalBudget : null;

  const budgetRatio = globalBudget ? Math.min(totalSpent / globalBudget, 1.5) : null;
  const budgetTone =
    budgetRatio == null
      ? "bg-neutral-300"
      : budgetRatio < 0.8
        ? "bg-emerald-500"
        : budgetRatio <= 1
          ? "bg-amber-500"
          : "bg-red-500";

  const recent = txRows.slice(0, 8);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingLimit = new Date();
  upcomingLimit.setDate(upcomingLimit.getDate() + 7);
  const upcomingRecurring = dueRecurring.filter((r) => r.nextDueDate <= upcomingLimit.toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <section className="rounded-2xl border border-neutral-200 p-4">
        <p className="text-xs text-neutral-400">Wydano w tym miesiącu</p>
        <p className="mt-1 text-3xl font-semibold text-neutral-900">{formatPln(totalSpent)}</p>
        {globalBudget != null ? (
          <>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${budgetTone}`}
                style={{ width: `${Math.min((totalSpent / globalBudget) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              limit {formatPln(globalBudget)} · zostało {formatPln(Math.max(globalBudget - totalSpent, 0))}
            </p>
          </>
        ) : (
          <Link href="/budzet" className="mt-2 inline-block text-xs text-neutral-500 underline">
            Ustaw miesięczny limit budżetu
          </Link>
        )}
      </section>

      {forecastDiff != null && dayOfMonth < daysInMonth && (
        <section
          className={`rounded-2xl p-4 text-sm ${
            forecastDiff > 0 ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {forecastDiff > 0
            ? `Przy obecnym tempie przekroczysz budżet o ${formatPln(forecastDiff)} do końca miesiąca.`
            : `Jesteś na dobrej drodze — przy obecnym tempie zostanie Ci ok. ${formatPln(-forecastDiff)}.`}
        </section>
      )}

      {upcomingRecurring.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">Nadchodzące płatności cykliczne</h2>
            <Link href="/cykliczne" className="text-xs text-neutral-500 underline">
              Zarządzaj
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {upcomingRecurring.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-neutral-900">{r.name}</p>
                  <p className={`text-xs ${r.nextDueDate < today ? "font-medium text-red-600" : "text-neutral-400"}`}>
                    {new Date(r.nextDueDate).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <span className="font-medium text-neutral-900">{formatPln(r.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Top kategorie</h2>
        {topCategories.length === 0 ? (
          <p className="text-sm text-neutral-400">Brak wydatków w tym miesiącu.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {topCategories.map(({ category, spent }) => (
              <li key={category?.id ?? "inne"}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-neutral-800">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category?.color ?? "#a3a3a3" }}
                    />
                    {category?.name ?? "Inne"}
                  </span>
                  <span className="font-medium text-neutral-900">{formatPln(spent)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxCategorySpent ? (spent / maxCategorySpent) * 100 : 0}%`,
                      backgroundColor: category?.color ?? "#a3a3a3",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Ostatnie wydatki</h2>
          <Link href="/historia" className="text-xs text-neutral-500 underline">
            Historia i szukaj
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Nie dodano jeszcze żadnego wydatku.{" "}
            <Link href="/dodaj" className="underline">
              Dodaj pierwszy
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {recent.map((transaction) => {
              const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
              return (
                <li key={transaction.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="text-neutral-900">{transactionLabel(transaction, category)}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(transaction.occurredOn).toLocaleDateString("pl-PL")}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </div>
                  <span className="font-medium text-neutral-900">{formatPln(transaction.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
