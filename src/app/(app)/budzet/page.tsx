import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod, formatPln } from "@/lib/date";
import { budgets, categories, monthlyBudgets, transactions } from "@/db/schema";
import { saveBudgets } from "./actions";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const { periodStart } = monthPeriod();

  const [monthlyBudget, categoryBudgets, categoryRows, txRows] = await Promise.all([
    db
      .select({ limitAmount: monthlyBudgets.limitAmount })
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.householdId, household.id), eq(monthlyBudgets.period, periodStart)))
      .get(),
    db
      .select({ categoryId: budgets.categoryId, limitAmount: budgets.limitAmount })
      .from(budgets)
      .where(and(eq(budgets.householdId, household.id), eq(budgets.period, periodStart)))
      .all(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select({ amount: transactions.amount, categoryId: transactions.categoryId })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          eq(transactions.type, "expense"),
          gte(transactions.occurredOn, periodStart),
        ),
      )
      .all(),
  ]);

  const limitByCategory = new Map(categoryBudgets.map((b) => [b.categoryId, b.limitAmount]));
  const spentByCategory = new Map<string, number>();
  for (const t of txRows) {
    if (!t.categoryId) continue;
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
  }
  const totalSpent = txRows.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Budżet miesięczny</h1>
        <Link href="/cykliczne" className="text-sm text-neutral-500 underline">
          Wydatki cykliczne
        </Link>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Limity zapisane.</div>
      )}

      <form action={saveBudgets} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Limit globalny (cały miesiąc)
          <input
            name="limit__global"
            type="text"
            inputMode="decimal"
            defaultValue={monthlyBudget?.limitAmount ?? ""}
            placeholder="np. 6000"
            className="rounded-lg border border-neutral-300 px-3 py-2.5 text-lg font-medium outline-none focus:border-neutral-900"
          />
          <span className="text-xs text-neutral-400">Wydano dotąd: {formatPln(totalSpent)}</span>
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Limity per kategoria (opcjonalnie)</p>
          <div className="flex flex-col divide-y divide-neutral-100">
            {categoryRows.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-neutral-800">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color ?? "#a3a3a3" }} />
                  <div>
                    <p>{category.name}</p>
                    <p className="text-xs text-neutral-400">
                      wydano {formatPln(spentByCategory.get(category.id) ?? 0)}
                    </p>
                  </div>
                </div>
                <input
                  name={`limit__cat__${category.id}`}
                  type="text"
                  inputMode="decimal"
                  defaultValue={limitByCategory.get(category.id) ?? ""}
                  placeholder="—"
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-right text-sm outline-none focus:border-neutral-900"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
        >
          Zapisz limity
        </button>
      </form>
    </div>
  );
}
