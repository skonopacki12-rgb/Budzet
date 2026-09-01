import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod, formatPln } from "@/lib/date";
import { budgets, categories, monthlyBudgets, transactions } from "@/db/schema";
import { ConfirmButton } from "@/components/ConfirmButton";
import { copyBudgetsFromPreviousMonth, saveBudgets } from "./actions";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; copied?: string; copy_empty?: string }>;
}) {
  const { saved, copied, copy_empty: copyEmpty } = await searchParams;
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
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Budżet miesięczny</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/cykliczne" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
            Cykliczne
          </Link>
          <Link href="/cele" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
            Cele
          </Link>
          <Link href="/statystyki" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
            Statystyki
          </Link>
          <Link href="/ceny" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
            Ceny
          </Link>
        </div>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">Limity zapisane.</div>
      )}
      {copied && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Limity przepisane z poprzedniego miesiąca.
        </div>
      )}
      {copyEmpty && (
        <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300">
          Poprzedni miesiąc nie miał ustawionych żadnych limitów.
        </div>
      )}

      <form action={copyBudgetsFromPreviousMonth}>
        <ConfirmButton
          confirmMessage="Nadpisać obecne limity wartościami z poprzedniego miesiąca?"
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Skopiuj limity z poprzedniego miesiąca
        </ConfirmButton>
      </form>

      <form action={saveBudgets} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
          Limit globalny (cały miesiąc)
          <input
            name="limit__global"
            type="text"
            inputMode="decimal"
            defaultValue={monthlyBudget?.limitAmount ?? ""}
            placeholder="np. 6000"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-lg font-medium outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
          />
          <span className="text-xs text-neutral-400 dark:text-neutral-500">Wydano dotąd: {formatPln(totalSpent)}</span>
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Limity per kategoria (opcjonalnie)</p>
          <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
            {categoryRows.map((category) => {
              const spent = spentByCategory.get(category.id) ?? 0;
              const limit = limitByCategory.get(category.id);
              const ratio = limit ? Math.min(spent / limit, 1.5) : null;
              const tone =
                ratio == null ? null : ratio < 0.8 ? "bg-emerald-500" : ratio <= 1 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={category.id} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color ?? "#a3a3a3" }} />
                      <div>
                        <p>{category.name}</p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          wydano {formatPln(spent)}
                          {limit != null ? ` z ${formatPln(limit)}` : ""}
                        </p>
                      </div>
                    </div>
                    <input
                      name={`limit__cat__${category.id}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={limitByCategory.get(category.id) ?? ""}
                      placeholder="—"
                      className="w-24 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-right text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
                    />
                  </div>
                  {tone && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${tone}`}
                        style={{ width: `${Math.min(((limit ? spent / limit : 0) * 100), 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-3 text-sm font-medium text-white dark:text-neutral-900"
        >
          Zapisz limity
        </button>
      </form>
    </div>
  );
}
