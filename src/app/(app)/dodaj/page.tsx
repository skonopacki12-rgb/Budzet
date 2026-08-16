import { redirect } from "next/navigation";
import { asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { categories, subcategories } from "@/db/schema";
import { ExpenseForm } from "@/components/ExpenseForm";
import { addExpense } from "./actions";

export default async function AddExpensePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const [categoryRows, subcategoryRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select()
      .from(subcategories)
      .where(or(isNull(subcategories.householdId), eq(subcategories.householdId, household.id)))
      .orderBy(asc(subcategories.sortOrder))
      .all(),
  ]);

  return (
    <div className="pt-2 md:max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dodaj wydatek</h1>
      <ExpenseForm categories={categoryRows} subcategories={subcategoryRows} action={addExpense} />
    </div>
  );
}
