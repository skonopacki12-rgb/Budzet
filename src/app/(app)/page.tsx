import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod, formatPln } from "@/lib/date";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) return null;

  const { periodStart, periodEnd, daysInMonth, dayOfMonth } = monthPeriod();

  const [{ data: monthlyBudget }, { data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from("monthly_budgets")
      .select("limit_amount")
      .eq("household_id", household.id)
      .eq("period", periodStart)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, amount, category_id, shop, note, occurred_on, created_at")
      .eq("household_id", household.id)
      .eq("type", "expense")
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));

  const totalSpent = (transactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const globalBudget = monthlyBudget?.limit_amount ?? null;

  const spentByCategory = new Map<string, number>();
  for (const transaction of transactions ?? []) {
    const key = transaction.category_id ?? "inne";
    spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(transaction.amount));
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

  const recent = (transactions ?? []).slice(0, 8);

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
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Ostatnie wydatki</h2>
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
              const category = transaction.category_id ? categoryById.get(transaction.category_id) : undefined;
              return (
                <li key={transaction.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="text-neutral-900">{transaction.shop || category?.name || "Wydatek"}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(transaction.occurred_on).toLocaleDateString("pl-PL")}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </div>
                  <span className="font-medium text-neutral-900">{formatPln(Number(transaction.amount))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
