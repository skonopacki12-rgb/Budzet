"use client";

import { useState } from "react";
import type { Category, ReceiptItem, Subcategory } from "@/db/schema";

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
  const [categoryByItem, setCategoryByItem] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.categoryId ?? categories[0]?.id ?? ""])),
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="receipt_id" value={receiptId} />

      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const selectedCategory = categoryByItem[item.id] ?? "";
          const subcategoryOptions = subcategories.filter((sub) => sub.categoryId === selectedCategory);

          return (
            <li key={item.id} className="rounded-2xl border border-neutral-200 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`item__${item.id}__include`}
                  defaultChecked
                  className="mt-0.5"
                />
                <span className="flex-1 text-neutral-900">{item.rawName}</span>
              </label>

              <div className="mt-2 flex flex-col gap-2 pl-6">
                <div className="flex gap-2">
                  <select
                    name={`item__${item.id}__category_id`}
                    value={selectedCategory}
                    onChange={(event) =>
                      setCategoryByItem((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                    className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
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
                    defaultValue={item.totalPrice.toString().replace(".", ",")}
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-right text-sm outline-none focus:border-neutral-900"
                  />
                </div>

                {subcategoryOptions.length > 0 && (
                  <select
                    name={`item__${item.id}__subcategory_id`}
                    defaultValue={item.subcategoryId ?? ""}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
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

      <p className="text-xs text-neutral-400">
        Odznacz pozycję, jeśli AI błędnie ją rozpoznała — nie zostanie zapisana jako wydatek.
      </p>

      <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white">
        Zatwierdź i zapisz jako wydatki
      </button>
    </form>
  );
}
