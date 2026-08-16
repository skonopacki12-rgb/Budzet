import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln, lastMonthKeys, monthLabel } from "@/lib/date";
import { categories, transactions } from "@/db/schema";

const MONTHS_BACK = 12;

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const now = new Date();
  const currentYear = now.getFullYear();
  const twoYearsAgoStart = `${currentYear - 1}-01-01`;

  const [rows, categoryRows] = await Promise.all([
    db
      .select({ amount: transactions.amount, occurredOn: transactions.occurredOn, categoryId: transactions.categoryId })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          eq(transactions.type, "expense"),
          gte(transactions.occurredOn, twoYearsAgoStart),
        ),
      )
      .all(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
  ]);
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));

  const months = lastMonthKeys(MONTHS_BACK, now);
  const totalsByMonth = new Map<string, number>(months.map((key) => [key, 0]));
  const totalsByYear = new Map<number, number>();
  const categoryTotalsThisYear = new Map<string, number>();

  for (const row of rows) {
    const key = row.occurredOn.slice(0, 7);
    if (totalsByMonth.has(key)) {
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + row.amount);
    }
    const year = Number(row.occurredOn.slice(0, 4));
    totalsByYear.set(year, (totalsByYear.get(year) ?? 0) + row.amount);
    if (year === currentYear) {
      const catKey = row.categoryId ?? "inne";
      categoryTotalsThisYear.set(catKey, (categoryTotalsThisYear.get(catKey) ?? 0) + row.amount);
    }
  }

  const monthBars = months.map((key) => ({ key, total: totalsByMonth.get(key) ?? 0 }));
  const maxMonthTotal = Math.max(...monthBars.map((m) => m.total), 1);

  const currentMonthTotal = monthBars[monthBars.length - 1]?.total ?? 0;
  const previousMonthTotal = monthBars[monthBars.length - 2]?.total ?? 0;
  const monthDelta = currentMonthTotal - previousMonthTotal;
  const monthDeltaPct = previousMonthTotal > 0 ? (monthDelta / previousMonthTotal) * 100 : null;

  const thisYearTotal = totalsByYear.get(currentYear) ?? 0;
  const lastYearTotal = totalsByYear.get(currentYear - 1) ?? 0;
  const yearDelta = thisYearTotal - lastYearTotal;
  const yearDeltaPct = lastYearTotal > 0 ? (yearDelta / lastYearTotal) * 100 : null;

  const topCategories = [...categoryTotalsThisYear.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, spent]) => ({ category: categoryById.get(categoryId), spent }));
  const maxCategorySpent = topCategories[0]?.spent ?? 0;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">Statystyki</h1>
        <Link href="/budzet" className="text-sm text-neutral-500 underline self-start">
          Budżet
        </Link>
      </div>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <p className="text-xs text-neutral-400">Ten miesiąc vs poprzedni</p>
        <p className="mt-1 text-2xl font-semibold text-neutral-900">{formatPln(currentMonthTotal)}</p>
        <p className={`mt-1 text-sm ${monthDelta > 0 ? "text-red-600" : monthDelta < 0 ? "text-emerald-600" : "text-neutral-500"}`}>
          {monthDelta === 0
            ? "Tyle samo co w poprzednim miesiącu."
            : `${monthDelta > 0 ? "+" : ""}${formatPln(monthDelta)}${monthDeltaPct != null ? ` (${monthDelta > 0 ? "+" : ""}${monthDeltaPct.toFixed(0)}%)` : ""} vs poprzedni miesiąc`}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-700">Ostatnie {MONTHS_BACK} miesięcy</h2>
        {/* Bars and labels are separate rows on purpose: a bar's percentage
            height only resolves against a parent with a *definite* height,
            and nesting the label in the same flex-col item (sized by content,
            since the row uses items-end) made that height indefinite —
            collapsing every bar to 0. */}
        <div className="flex h-32 items-stretch gap-1.5">
          {monthBars.map(({ key, total }) => (
            <div key={key} className="flex flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t bg-neutral-900"
                style={{ height: `${maxMonthTotal ? Math.max((total / maxMonthTotal) * 100, total > 0 ? 4 : 0) : 0}%` }}
                title={formatPln(total)}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          {monthBars.map(({ key }) => (
            <span key={key} className="flex-1 text-center text-[10px] text-neutral-400">
              {monthLabel(key)}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <p className="text-xs text-neutral-400">Rok {currentYear} vs {currentYear - 1}</p>
        <p className="mt-1 text-2xl font-semibold text-neutral-900">{formatPln(thisYearTotal)}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {currentYear - 1}: {formatPln(lastYearTotal)}
          {lastYearTotal > 0 && (
            <span className={yearDelta > 0 ? "text-red-600" : yearDelta < 0 ? "text-emerald-600" : ""}>
              {" "}
              ({yearDelta > 0 ? "+" : ""}
              {yearDeltaPct != null ? yearDeltaPct.toFixed(0) : "0"}%)
            </span>
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Top kategorie w {currentYear} roku</h2>
        {topCategories.length === 0 ? (
          <p className="text-sm text-neutral-400">Brak wydatków w tym roku.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {topCategories.map(({ category, spent }) => (
              <li key={category?.id ?? "inne"}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-neutral-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category?.color ?? "#a3a3a3" }} />
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
    </div>
  );
}
