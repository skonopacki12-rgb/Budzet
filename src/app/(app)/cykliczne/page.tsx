import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { categories, recurringExpenses, subcategories } from "@/db/schema";
import { RecurringExpenseForm } from "@/components/RecurringExpenseForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  addRecurringExpense,
  deleteRecurringExpense,
  markRecurringExpensePaid,
  toggleRecurringExpenseActive,
} from "./actions";

const CYCLE_LABELS: Record<string, string> = {
  monthly: "co miesiąc",
  quarterly: "co kwartał",
  yearly: "co rok",
  custom_days: "co X dni",
};

export default async function RecurringExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const [categoryRows, subcategoryRows, recurringRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select()
      .from(subcategories)
      .where(or(isNull(subcategories.householdId), eq(subcategories.householdId, household.id)))
      .orderBy(asc(subcategories.sortOrder))
      .all(),
    db
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.householdId, household.id))
      .orderBy(desc(recurringExpenses.active), asc(recurringExpenses.nextDueDate))
      .all(),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">Wydatki cykliczne</h1>
        <Link href="/budzet" className="text-sm text-neutral-500 underline self-start">
          Budżet
        </Link>
      </div>

      <section>
        {recurringRows.length === 0 ? (
          <p className="text-sm text-neutral-400">Brak wydatków cyklicznych — dodaj pierwszy poniżej.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recurringRows.map((recurring) => {
              const category = recurring.categoryId ? categoryById.get(recurring.categoryId) : undefined;
              const overdue = recurring.active && recurring.nextDueDate < today;

              return (
                <li
                  key={recurring.id}
                  className={`rounded-2xl border p-4 ${
                    recurring.active ? "border-neutral-200" : "border-neutral-100 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">{recurring.name}</p>
                      <p className="text-xs text-neutral-500">
                        {category?.name ?? "Bez kategorii"} · {CYCLE_LABELS[recurring.cycle]}
                        {recurring.cycle === "custom_days" && recurring.customDays
                          ? ` (${recurring.customDays} dni)`
                          : ""}
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-neutral-900">{formatPln(recurring.amount)}</span>
                  </div>

                  <p className={`mt-2 text-xs ${overdue ? "font-medium text-red-600" : "text-neutral-500"}`}>
                    {recurring.active
                      ? `${overdue ? "Zaległe od" : "Następna płatność"}: ${new Date(recurring.nextDueDate).toLocaleDateString("pl-PL")}`
                      : "Wstrzymane"}
                  </p>
                  {recurring.contractEndDate && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Umowa do {new Date(recurring.contractEndDate).toLocaleDateString("pl-PL")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {recurring.active && (
                      <form action={markRecurringExpensePaid}>
                        <input type="hidden" name="id" value={recurring.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Zapłacone
                        </button>
                      </form>
                    )}
                    <form action={toggleRecurringExpenseActive}>
                      <input type="hidden" name="id" value={recurring.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                      >
                        {recurring.active ? "Wstrzymaj" : "Wznów"}
                      </button>
                    </form>
                    <form action={deleteRecurringExpense}>
                      <input type="hidden" name="id" value={recurring.id} />
                      <ConfirmButton
                        confirmMessage={`Usunąć „${recurring.name}”?`}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600"
                      >
                        Usuń
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-neutral-100 pt-6 md:max-w-md">
        <h2 className="text-sm font-medium text-neutral-700">Dodaj wydatek cykliczny</h2>
        <RecurringExpenseForm categories={categoryRows} subcategories={subcategoryRows} action={addRecurringExpense} />
      </section>
    </div>
  );
}
