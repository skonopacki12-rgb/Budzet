import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { receiptItems, receipts } from "@/db/schema";
import { PriceHistoryChart, storeColor } from "@/components/PriceHistoryChart";

interface PriceEntry {
  date: string;
  store: string;
  price: number;
}

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; produkt?: string }>;
}) {
  const { q, produkt } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const rows = await db
    .select({
      rawName: receiptItems.rawName,
      quantity: receiptItems.quantity,
      totalPrice: receiptItems.totalPrice,
      storeName: receipts.storeName,
      purchaseDate: receipts.purchaseDate,
      createdAt: receipts.createdAt,
    })
    .from(receiptItems)
    .innerJoin(receipts, eq(receipts.id, receiptItems.receiptId))
    .where(and(eq(receipts.householdId, household.id), eq(receiptItems.confirmed, true)))
    .all();

  const groups = new Map<string, { displayName: string; entries: PriceEntry[] }>();
  for (const row of rows) {
    const key = row.rawName.trim().toLowerCase();
    if (!key) continue;

    const price = row.quantity > 0 ? row.totalPrice / row.quantity : row.totalPrice;
    const date = row.purchaseDate ?? row.createdAt.slice(0, 10);
    const store = row.storeName?.trim() || "Nieznany sklep";

    if (!groups.has(key)) groups.set(key, { displayName: row.rawName.trim(), entries: [] });
    groups.get(key)!.entries.push({ date, store, price });
  }
  for (const group of groups.values()) {
    group.entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  const products = [...groups.entries()]
    .map(([key, group]) => {
      const prices = group.entries.map((entry) => entry.price);
      const last = group.entries[group.entries.length - 1];
      return {
        key,
        displayName: group.displayName,
        count: group.entries.length,
        storeCount: new Set(group.entries.map((entry) => entry.store)).size,
        lastPrice: last.price,
        lastDate: last.date,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));

  const queryLower = q?.trim().toLowerCase();
  const filteredProducts = queryLower
    ? products.filter((product) => product.displayName.toLowerCase().includes(queryLower))
    : products;

  const selected = produkt ? groups.get(produkt) : undefined;
  const selectedEntriesDesc = selected ? [...selected.entries].reverse() : [];
  const storesInOrder = selected ? [...new Set(selected.entries.map((entry) => entry.store))] : [];

  if (selected) {
    return (
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{selected.displayName}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/ceny" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
              Wszystkie produkty
            </Link>
            <Link href="/budzet" className="text-sm text-neutral-500 dark:text-neutral-400 underline">
              Budżet
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {selected.entries.length} {selected.entries.length === 1 ? "zakup" : "zakupów"} ·{" "}
            {storesInOrder.length} {storesInOrder.length === 1 ? "sklep" : "sklepy"}
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {formatPln(selectedEntriesDesc[0].price)}
          </p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            ostatnio {new Date(selectedEntriesDesc[0].date).toLocaleDateString("pl-PL")} w{" "}
            {selectedEntriesDesc[0].store}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">Cena w czasie, wg sklepu</h2>
          <PriceHistoryChart entries={selected.entries} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Historia zakupów</h2>
          <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
            {selectedEntriesDesc.map((entry, index) => (
              <li key={index} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: storeColor(entry.store, storesInOrder) }}
                  />
                  <div>
                    <p className="text-neutral-900 dark:text-neutral-100">{entry.store}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{new Date(entry.date).toLocaleDateString("pl-PL")}</p>
                  </div>
                </div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatPln(entry.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Ceny produktów</h1>
        <Link href="/budzet" className="text-sm text-neutral-500 dark:text-neutral-400 underline self-start">
          Budżet
        </Link>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Historia cen z potwierdzonych pozycji paragonów — do porównania, czy ten sam produkt drożeje i w którym
        sklepie jest taniej.
      </p>

      <form className="flex gap-2">
        <input
          name="q"
          type="text"
          defaultValue={q ?? ""}
          placeholder="Szukaj produktu…"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-sm font-medium text-white dark:text-neutral-900">
          Szukaj
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">
          Brak jeszcze danych — ceny pojawią się tu po potwierdzeniu pozycji ze skanu paragonu.
        </p>
      ) : filteredProducts.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Nic nie pasuje do „{q}”.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredProducts.map((product) => (
            <li key={product.key}>
              <Link
                href={`/ceny?produkt=${encodeURIComponent(product.key)}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-900 dark:text-neutral-100">{product.displayName}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {product.count} {product.count === 1 ? "zakup" : "zakupów"} · {product.storeCount}{" "}
                    {product.storeCount === 1 ? "sklep" : "sklepy"}
                    {product.minPrice !== product.maxPrice &&
                      ` · ${formatPln(product.minPrice)}–${formatPln(product.maxPrice)}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatPln(product.lastPrice)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
