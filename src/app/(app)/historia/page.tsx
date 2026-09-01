import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { transactionLabel } from "@/lib/transactions";
import { categories, transactions } from "@/db/schema";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteTransaction, toggleUnnecessary } from "./actions";

const PAGE_SIZE = 50;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category_id?: string;
    from?: string;
    to?: string;
    edited?: string;
    page?: string;
    unnecessary?: string;
  }>;
}) {
  const { q, category_id: categoryId, from, to, edited, page: pageParam, unnecessary: unnecessaryParam } =
    await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const baseConditions = [eq(transactions.householdId, household.id), eq(transactions.type, "expense")];
  if (q?.trim()) {
    const pattern = `%${q.trim()}%`;
    baseConditions.push(or(like(transactions.shop, pattern), like(transactions.note, pattern))!);
  }
  if (categoryId) {
    baseConditions.push(eq(transactions.categoryId, categoryId));
  }
  if (from) {
    baseConditions.push(gte(transactions.occurredOn, from));
  }
  if (to) {
    baseConditions.push(lte(transactions.occurredOn, to));
  }

  const unnecessaryOnly = unnecessaryParam === "1";
  const conditions = unnecessaryOnly ? [...baseConditions, eq(transactions.unnecessary, true)] : baseConditions;

  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, sumRows, unnecessarySumRows, totalCountRow, categoryRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)
      .all(),
    // Unpaginated: "Suma" covers every matching result, not just the current
    // page. Every expense counts here — "zbędny" is a marker for future
    // savings, not a reason to hide real spending from the total.
    db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(and(...conditions))
      .all(),
    db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(and(...baseConditions, eq(transactions.unnecessary, true)))
      .all(),
    db.select({ value: count() }).from(transactions).where(and(...conditions)).get(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const total = sumRows.reduce((sum, row) => sum + row.amount, 0);
  const unnecessaryTotal = unnecessarySumRows.reduce((sum, row) => sum + row.amount, 0);
  const totalCount = totalCountRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(q?.trim() || categoryId || from || to || unnecessaryOnly);

  const baseParams = new URLSearchParams();
  if (q?.trim()) baseParams.set("q", q.trim());
  if (categoryId) baseParams.set("category_id", categoryId);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);

  const exportHref = `/historia/eksport${baseParams.size > 0 ? `?${baseParams.toString()}` : ""}`;

  const unnecessaryToggleParams = new URLSearchParams(baseParams);
  if (!unnecessaryOnly) unnecessaryToggleParams.set("unnecessary", "1");
  const unnecessaryToggleHref = `/historia${unnecessaryToggleParams.toString() ? `?${unnecessaryToggleParams.toString()}` : ""}`;

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams(baseParams);
    if (unnecessaryOnly) params.set("unnecessary", "1");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/historia${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Historia wydatków</h1>

      {edited && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">Zmiany zapisane.</div>
      )}

      <form className="flex flex-col gap-3">
        {unnecessaryOnly && <input type="hidden" name="unnecessary" value="1" />}
        <input
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Szukaj po sklepie lub notatce"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        />

        <select
          name="category_id"
          defaultValue={categoryId ?? ""}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        >
          <option value="">Wszystkie kategorie</option>
          {categoryRows.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            Od
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            Do
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-2.5 text-sm font-medium text-white dark:text-neutral-900">
            Szukaj
          </button>
          {hasFilters && (
            <Link
              href="/historia"
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Wyczyść
            </Link>
          )}
        </div>
      </form>

      <Link
        href={unnecessaryToggleHref}
        className={`self-start rounded-lg border px-3 py-1.5 text-xs font-medium ${
          unnecessaryOnly
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        }`}
      >
        {unnecessaryOnly ? "✓ Tylko zbędne" : "Pokaż tylko zbędne"}
      </Link>

      <section>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">
            {totalCount} {totalCount === 1 ? "wynik" : "wyników"}
          </span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Suma: {formatPln(total)}</span>
        </div>
        {!unnecessaryOnly && unnecessaryTotal > 0 && (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
            z tego zbędne: {formatPln(unnecessaryTotal)} — potencjalna oszczędność, jeśli z nich zrezygnujesz
          </p>
        )}

        {rows.length > 0 && (
          <a href={exportHref} className="mb-3 mt-2 inline-block text-xs text-neutral-500 dark:text-neutral-400 underline">
            Eksportuj do CSV
          </a>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Brak wydatków spełniających kryteria.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((transaction) => {
              const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
              return (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-neutral-900 dark:text-neutral-100">
                      {transactionLabel(transaction, category)}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {new Date(transaction.occurredOn).toLocaleDateString("pl-PL")}
                      {category ? ` · ${category.name}` : ""}
                      {transaction.unnecessary ? " · zbędny" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatPln(transaction.amount)}
                    </span>
                    <div className="flex items-center gap-3">
                      <form action={toggleUnnecessary}>
                        <input type="hidden" name="id" value={transaction.id} />
                        <input type="hidden" name="next" value={transaction.unnecessary ? "0" : "1"} />
                        <button
                          type="submit"
                          className={`text-xs font-medium underline ${
                            transaction.unnecessary
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-neutral-500 dark:text-neutral-400"
                          }`}
                        >
                          {transaction.unnecessary ? "Zbędny ✓" : "Oznacz jako zbędny"}
                        </button>
                      </form>
                      <Link href={`/historia/${transaction.id}/edytuj`} className="text-xs font-medium text-neutral-600 dark:text-neutral-300 underline">
                        Edytuj
                      </Link>
                      <form action={deleteTransaction}>
                        <input type="hidden" name="id" value={transaction.id} />
                        <ConfirmButton
                          confirmMessage="Usunąć ten wydatek?"
                          className="text-xs font-medium text-red-600 dark:text-red-400"
                        >
                          Usuń
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="text-neutral-700 dark:text-neutral-300 underline">
                Poprzednia
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              Strona {page} z {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="text-neutral-700 dark:text-neutral-300 underline">
                Następna
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
