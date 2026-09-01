import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { categories, receipts, receiptItems, subcategories } from "@/db/schema";
import { ReceiptItemsForm } from "@/components/ReceiptItemsForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { confirmReceipt, deleteReceipt } from "./actions";

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { id } = await params;
  const { confirmed } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const receipt = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.householdId, household.id)))
    .get();
  if (!receipt) redirect("/paragony");

  const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, id)).all();
  const unconfirmed = items.filter((item) => !item.confirmed);
  const confirmedItems = items.filter((item) => item.confirmed);

  const [categoryRows, subcategoryRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select()
      .from(subcategories)
      .where(or(isNull(subcategories.householdId), eq(subcategories.householdId, household.id)))
      .orderBy(asc(subcategories.sortOrder))
      .all(),
  ]);
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {receipt.storeName || "Paragon"}
        </h1>
        <Link href="/paragony" className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400 underline">
          Wróć
        </Link>
      </div>

      {confirmed && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Wydatki zapisane.
        </div>
      )}

      <img
        src={`/paragony/${id}/obraz`}
        alt="Zdjęcie paragonu"
        className="max-h-64 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 object-contain"
      />

      <div className="flex gap-4 text-sm text-neutral-500 dark:text-neutral-400">
        {receipt.purchaseDate && <span>{new Date(receipt.purchaseDate).toLocaleDateString("pl-PL")}</span>}
        {receipt.totalAmount != null && <span>Suma: {formatPln(receipt.totalAmount)}</span>}
      </div>

      {receipt.status === "error" && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          Nie udało się odczytać paragonu: {receipt.errorMessage || "nieznany błąd."} Spróbuj zrobić wyraźniejsze
          zdjęcie i dodaj paragon ponownie.
        </div>
      )}

      {(receipt.status === "queued" || receipt.status === "ocr" || receipt.status === "ai") && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Analizowanie w toku…</p>
      )}

      {receipt.status === "ready" && items.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">AI nie rozpoznało żadnych pozycji na tym paragonie.</p>
      )}

      {receipt.rawText && (
        <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-300">Surowy tekst odczytany przez AI</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-neutral-500 dark:text-neutral-400">{receipt.rawText}</pre>
        </details>
      )}

      {confirmedItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Zapisane wydatki</h2>
          <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
            {confirmedItems.map((item) => {
              const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
              return (
                <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-neutral-900 dark:text-neutral-100">{item.rawName}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{category?.name ?? "Bez kategorii"}</p>
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatPln(item.totalPrice)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unconfirmed.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Do potwierdzenia</h2>
          <ReceiptItemsForm
            receiptId={id}
            items={unconfirmed}
            categories={categoryRows}
            subcategories={subcategoryRows}
            action={confirmReceipt}
          />
        </section>
      )}

      <form action={deleteReceipt} className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
        <input type="hidden" name="receipt_id" value={id} />
        <ConfirmButton
          confirmMessage="Usunąć ten paragon? Zdjęcie i niepotwierdzone pozycje znikną (zapisane już wydatki zostaną)."
          className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400"
        >
          Usuń paragon
        </ConfirmButton>
      </form>
    </div>
  );
}
