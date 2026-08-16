import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { savingsGoals } from "@/db/schema";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addContribution, addSavingsGoal, deleteSavingsGoal } from "./actions";

export default async function SavingsGoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.householdId, household.id))
    .orderBy(desc(savingsGoals.achieved), desc(savingsGoals.createdAt))
    .all();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Cele oszczędnościowe</h1>
        <Link href="/budzet" className="text-sm text-neutral-500 underline">
          Budżet
        </Link>
      </div>

      <section>
        {goals.length === 0 ? (
          <p className="text-sm text-neutral-400">Brak celów — dodaj pierwszy poniżej.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map((goal) => {
              const ratio = Math.min(goal.currentAmount / goal.targetAmount, 1);
              const overdue = !goal.achieved && goal.targetDate != null && goal.targetDate < today;

              return (
                <li
                  key={goal.id}
                  className={`rounded-2xl border p-4 ${goal.achieved ? "border-emerald-200 bg-emerald-50" : "border-neutral-200"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {goal.name} {goal.achieved && "🎉"}
                      </p>
                      {goal.targetDate && (
                        <p className={`text-xs ${overdue ? "font-medium text-red-600" : "text-neutral-500"}`}>
                          {overdue ? "Termin minął" : "Do"} {new Date(goal.targetDate).toLocaleDateString("pl-PL")}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-neutral-900">
                      {formatPln(goal.currentAmount)} / {formatPln(goal.targetAmount)}
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${goal.achieved ? "bg-emerald-500" : "bg-neutral-900"}`}
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={addContribution} className="flex items-center gap-2">
                      <input type="hidden" name="goal_id" value={goal.id} />
                      <input
                        name="amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="np. 100"
                        className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Dodaj wpłatę
                      </button>
                    </form>
                    <form action={deleteSavingsGoal}>
                      <input type="hidden" name="goal_id" value={goal.id} />
                      <ConfirmButton
                        confirmMessage={`Usunąć cel „${goal.name}”?`}
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

      <section className="flex flex-col gap-3 border-t border-neutral-100 pt-6">
        <h2 className="text-sm font-medium text-neutral-700">Dodaj cel</h2>
        <form action={addSavingsGoal} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Nazwa
            <input
              name="name"
              required
              placeholder="np. Wakacje"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Kwota docelowa
            <input
              name="target_amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="np. 3000"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Termin (opcjonalnie)
            <input
              name="target_date"
              type="date"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white">
            Dodaj cel
          </button>
        </form>
      </section>
    </div>
  );
}
