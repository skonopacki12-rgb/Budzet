import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { formatPln } from "@/lib/date";
import { receipts } from "@/db/schema";

const STATUS_LABELS: Record<string, string> = {
  queued: "w kolejce",
  ocr: "odczytywanie",
  ai: "analiza AI",
  ready: "gotowe",
  error: "błąd",
};

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const rows = await db
    .select({
      id: receipts.id,
      storeName: receipts.storeName,
      purchaseDate: receipts.purchaseDate,
      totalAmount: receipts.totalAmount,
      status: receipts.status,
    })
    .from(receipts)
    .where(eq(receipts.householdId, household.id))
    .orderBy(desc(receipts.createdAt))
    .all();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Paragony</h1>
        <Link href="/paragony/nowy" className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-1.5 text-sm font-medium text-white dark:text-neutral-900">
          Dodaj paragon
        </Link>
      </div>

      {deleted && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">Paragon usunięty.</div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Brak paragonów. Zrób zdjęcie paragonu, a AI odczyta pozycje i zaproponuje kategorie do potwierdzenia.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((receipt) => (
            <li key={receipt.id}>
              <Link
                href={`/paragony/${receipt.id}`}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div>
                  <p className="text-neutral-900 dark:text-neutral-100">{receipt.storeName ?? "Paragon"}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("pl-PL") : "—"} ·{" "}
                    {STATUS_LABELS[receipt.status] ?? receipt.status}
                  </p>
                </div>
                {receipt.totalAmount != null && (
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatPln(receipt.totalAmount)}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
