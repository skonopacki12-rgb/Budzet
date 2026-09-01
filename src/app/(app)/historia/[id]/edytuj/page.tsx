import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { categories, subcategories, transactions } from "@/db/schema";
import { ExpenseForm } from "@/components/ExpenseForm";
import { updateTransaction } from "../../actions";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const transaction = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, household.id)))
    .get();
  if (!transaction) redirect("/historia");

  const [categoryRows, subcategoryRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select()
      .from(subcategories)
      .where(or(isNull(subcategories.householdId), eq(subcategories.householdId, household.id)))
      .orderBy(asc(subcategories.sortOrder))
      .all(),
  ]);

  const action = updateTransaction.bind(null, transaction.id);

  return (
    <div className="flex flex-col gap-6 pt-2 md:max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Edytuj wydatek</h1>
        <Link href="/historia" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
          Wróć
        </Link>
      </div>

      {transaction.receiptId && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Ten wydatek pochodzi ze skanu paragonu — zmiany tutaj nie wpływają na zapisany paragon.
        </p>
      )}

      <ExpenseForm
        categories={categoryRows}
        subcategories={subcategoryRows}
        action={action}
        submitLabel="Zapisz zmiany"
        initial={{
          amount: transaction.amount,
          occurredOn: transaction.occurredOn,
          categoryId: transaction.categoryId,
          subcategoryId: transaction.subcategoryId,
          shop: transaction.shop,
          note: transaction.note,
        }}
      />
    </div>
  );
}
