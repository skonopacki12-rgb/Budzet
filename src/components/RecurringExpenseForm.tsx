"use client";

import { useMemo, useState } from "react";
import type { Category, Subcategory } from "@/db/schema";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Co miesiąc",
  quarterly: "Co kwartał",
  yearly: "Co rok",
  custom_days: "Co X dni",
};

export function RecurringExpenseForm({
  categories,
  subcategories,
  action,
}: {
  categories: Category[];
  subcategories: Subcategory[];
  action: (formData: FormData) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [cycle, setCycle] = useState("monthly");

  const subcategoryOptions = useMemo(
    () => subcategories.filter((sub) => sub.categoryId === categoryId),
    [subcategories, categoryId],
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Nazwa
        <input
          name="name"
          type="text"
          required
          placeholder="np. Czynsz, Netflix"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Kwota (zł)
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          required
          placeholder="0,00"
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-2xl font-semibold outline-none focus:border-neutral-900"
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
        Cykl
        <select
          name="cycle"
          value={cycle}
          onChange={(event) => setCycle(event.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        >
          {Object.entries(CYCLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {cycle === "custom_days" && (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Liczba dni
          <input
            name="custom_days"
            type="number"
            min={1}
            required
            placeholder="np. 14"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Najbliższa płatność
        <input
          name="next_due_date"
          type="date"
          required
          defaultValue={todayIso()}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Koniec umowy (opcjonalnie)
        <input
          name="contract_end_date"
          type="date"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Metoda płatności (opcjonalnie)
        <input
          name="payment_method"
          type="text"
          placeholder="np. przelew, karta"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
        />
      </label>

      <button
        type="submit"
        className="mt-2 rounded-lg bg-neutral-900 px-3 py-3 text-sm font-medium text-white"
      >
        Zapisz wydatek cykliczny
      </button>
    </form>
  );
}
