"use client";

import { useMemo, useState } from "react";
import type { Category, Subcategory } from "@/db/schema";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export interface ExpenseFormInitialValues {
  amount: number;
  occurredOn: string;
  categoryId: string | null;
  subcategoryId: string | null;
  shop: string | null;
  note: string | null;
}

export function ExpenseForm({
  categories,
  subcategories,
  action,
  initial,
  submitLabel = "Zapisz wydatek",
}: {
  categories: Category[];
  subcategories: Subcategory[];
  action: (formData: FormData) => void;
  initial?: ExpenseFormInitialValues;
  submitLabel?: string;
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");

  const subcategoryOptions = useMemo(
    () => subcategories.filter((sub) => sub.categoryId === categoryId),
    [subcategories, categoryId],
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Kwota (zł)
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          required
          placeholder="0,00"
          defaultValue={initial ? String(initial.amount).replace(".", ",") : undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-2xl font-semibold outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Data
        <input
          name="occurred_on"
          type="date"
          required
          defaultValue={initial?.occurredOn ?? todayIso()}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Kategoria
        <select
          name="category_id"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      {subcategoryOptions.length > 0 && (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Podkategoria
          <select
            name="subcategory_id"
            defaultValue={initial?.subcategoryId ?? undefined}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          >
            {subcategoryOptions.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Sklep
        <input
          name="shop"
          type="text"
          placeholder="np. Biedronka"
          defaultValue={initial?.shop ?? undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Notatka
        <textarea
          name="note"
          rows={2}
          defaultValue={initial?.note ?? undefined}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <button
        type="submit"
        className="mt-2 rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}
