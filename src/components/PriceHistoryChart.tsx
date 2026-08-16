const STORE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

export interface PriceHistoryEntry {
  date: string;
  store: string;
  price: number;
}

/** Colors are assigned by first-appearance order so the same store keeps the same color across a session. */
export function storeColor(store: string, storesInOrder: string[]): string {
  const index = storesInOrder.indexOf(store);
  return STORE_COLORS[index % STORE_COLORS.length];
}

export function PriceHistoryChart({ entries }: { entries: PriceHistoryEntry[] }) {
  const storesInOrder = [...new Set(entries.map((entry) => entry.store))];
  const maxPrice = Math.max(...entries.map((entry) => entry.price), 0.01);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-32 items-stretch gap-1">
        {entries.map((entry, index) => (
          <div key={index} className="flex flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max((entry.price / maxPrice) * 100, 4)}%`,
                backgroundColor: storeColor(entry.store, storesInOrder),
              }}
              title={`${entry.store} — ${entry.price.toFixed(2)} zł (${new Date(entry.date).toLocaleDateString("pl-PL")})`}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {storesInOrder.map((store) => (
          <span key={store} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: storeColor(store, storesInOrder) }} />
            {store}
          </span>
        ))}
      </div>
    </div>
  );
}
