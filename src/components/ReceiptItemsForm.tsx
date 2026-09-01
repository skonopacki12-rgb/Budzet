"use client";

import { useMemo, useState } from "react";
import type { Category, ReceiptItem, Subcategory } from "@/db/schema";
import { formatPln } from "@/lib/date";

interface RowState {
  included: boolean;
  categoryId: string;
  subcategoryId: string;
  price: string;
}

function parsePriceLocal(text: string): number {
  const normalized = text.replace(",", ".").replace(/[^\d.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function ReceiptItemsForm({
  receiptId,
  items,
  categories,
  subcategories,
  action,
}: {
  receiptId: string;
  items: ReceiptItem[];
  categories: Category[];
  subcategories: Subcategory[];
  action: (formData: FormData) => void;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        {
          included: true,
          categoryId: item.categoryId ?? categories[0]?.id ?? "",
          subcategoryId: item.subcategoryId ?? "",
          price: item.totalPrice.toString().replace(".", ","),
        },
      ]),
    ),
  );

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      const row = rows[item.id];
      if (!row?.included) continue;
      totals.set(row.categoryId, (totals.get(row.categoryId) ?? 0) + parsePriceLocal(row.price));
    }
    return totals;
  }, [rows, items]);

  const grandTotal = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="receipt_id" value={receiptId} />

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        To jeszcze nie jest zapisane w budżecie — sprawdź pozycje poniżej i kliknij „Zatwierdź”.
      </div>

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const row = rows[item.id];
          const subcategoryOptions = subcategories.filter((sub) => sub.categoryId === row.categoryId);

          return (
            <li key={item.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`item__${item.id}__include`}
                  checked={row.included}
                  onChange={(event) => updateRow(item.id, { included: event.target.checked })}
                  className="mt-0.5"
                />
                <span className="flex-1 text-neutral-900 dark:text-neutral-100">{item.rawName}</span>
              </label>

              <div className="mt-2 flex flex-col gap-2 pl-6">
                <div className="flex gap-2">
                  <select
                    name={`item__${item.id}__category_id`}
                    value={row.categoryId}
                    onChange={(event) => updateRow(item.id, { categoryId: event.target.value, subcategoryId: "" })}
                    className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name={`item__${item.id}__total_price`}
                    type="text"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(item.id, { price: event.target.value })}
                    className="w-24 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-right text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
                  />
                </div>

                {subcategoryOptions.length > 0 && (
                  <select
                    name={`item__${item.id}__subcategory_id`}
                    value={row.subcategoryId}
                    onChange={(event) => updateRow(item.id, { subcategoryId: event.target.value })}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
                  >
                    <option value="">Bez podkategorii</option>
                    {subcategoryOptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Odznacz pozycję, jeśli AI błędnie ją rozpoznała — nie zostanie zapisana jako wydatek.
      </p>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
        <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Podsumowanie po kategoriach</h3>
        {categoryTotals.size === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Brak zaznaczonych pozycji.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800 text-sm">
            {[...categoryTotals.entries()].map(([categoryId, sum]) => {
              const category = categories.find((c) => c.id === categoryId);
              return (
                <li key={categoryId} className="flex items-center justify-between py-1.5">
                  <span className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category?.color ?? "#a3a3a3" }}
                    />
                    {category?.name ?? "Bez kategorii"}
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatPln(sum)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <span>Razem</span>
          <span>{formatPln(grandTotal)}</span>
        </div>
      </section>

      <button type="submit" className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-3 text-sm font-medium text-white dark:text-neutral-900">
        Zatwierdź i zapisz jako wydatki
      </button>
    </form>
  );
}
