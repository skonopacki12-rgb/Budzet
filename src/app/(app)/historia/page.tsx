import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { categories, transactions } from "@/db/schema";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteTransaction } from "./actions";

const RESULT_LIMIT = 200;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category_id?: string; from?: string; to?: string }>;
}) {
  const { q, category_id: categoryId, from, to } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const conditions = [eq(transactions.householdId, household.id), eq(transactions.type, "expense")];
  if (q?.trim()) {
    const pattern = `%${q.trim()}%`;
    conditions.push(or(like(transactions.shop, pattern), like(transactions.note, pattern))!);
  }
  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId));
  }
  if (from) {
    conditions.push(gte(transactions.occurredOn, from));
  }
  if (to) {
    conditions.push(lte(transactions.occurredOn, to));
  }

  const [rows, categoryRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(RESULT_LIMIT)
      .all(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const hasFilters = Boolean(q?.trim() || categoryId || from || to);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-xl font-semibold text-neutral-900">Historia wydatków</h1>

      <form className="flex flex-col gap-3">
        <input
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Szukaj po sklepie lub notatce"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />

        <select
          name="category_id"
          defaultValue={categoryId ?? ""}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        >
          <option value="">Wszystkie kategorie</option>
          {categoryRows.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500">
            Od
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500">
            Do
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white">
            Szukaj
          </button>
          {hasFilters && (
            <Link
              href="/historia"
              className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-700"
            >
              Wyczyść
            </Link>
          )}
        </div>
      </form>

      <section>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            {rows.length} {rows.length === 1 ? "wynik" : "wyników"}
            {rows.length === RESULT_LIMIT ? " (pokazano pierwsze " + RESULT_LIMIT + ")" : ""}
          </span>
          <span className="font-medium text-neutral-900">Suma: {formatPln(total)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400">Brak wydatków spełniających kryteria.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {rows.map((transaction) => {
              const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
              return (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-neutral-900">
                      {transaction.shop || transaction.note || category?.name || "Wydatek"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {new Date(transaction.occurredOn).toLocaleDateString("pl-PL")}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-medium text-neutral-900">{formatPln(transaction.amount)}</span>
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={transaction.id} />
                      <ConfirmButton
                        confirmMessage="Usunąć ten wydatek?"
                        className="text-xs font-medium text-red-600"
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
    </div>
  );
}
