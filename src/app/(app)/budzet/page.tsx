import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod, formatPln } from "@/lib/date";
import { saveBudgets } from "./actions";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  const { periodStart } = monthPeriod();

  const [{ data: monthlyBudget }, { data: categoryBudgets }, { data: categories }, { data: transactions }] =
    await Promise.all([
      supabase
        .from("monthly_budgets")
        .select("limit_amount")
        .eq("household_id", household.id)
        .eq("period", periodStart)
        .maybeSingle(),
      supabase.from("budgets").select("category_id, limit_amount").eq("household_id", household.id).eq(
        "period",
        periodStart,
      ),
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("household_id", household.id)
        .eq("type", "expense")
        .gte("occurred_on", periodStart),
    ]);

  const limitByCategory = new Map((categoryBudgets ?? []).map((b) => [b.category_id, b.limit_amount]));
  const spentByCategory = new Map<string, number>();
  for (const t of transactions ?? []) {
    if (!t.category_id) continue;
    spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const totalSpent = (transactions ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-xl font-semibold text-neutral-900">Budżet miesięczny</h1>

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
            defaultValue={monthlyBudget?.limit_amount ?? ""}
            placeholder="np. 6000"
            className="rounded-lg border border-neutral-300 px-3 py-2.5 text-lg font-medium outline-none focus:border-neutral-900"
          />
          <span className="text-xs text-neutral-400">Wydano dotąd: {formatPln(totalSpent)}</span>
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Limity per kategoria (opcjonalnie)</p>
          <div className="flex flex-col divide-y divide-neutral-100">
            {(categories ?? []).map((category) => (
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
