import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { receipts } from "@/db/schema";

export default async function ReceiptsPage() {
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
      <h1 className="text-xl font-semibold text-neutral-900">Archiwum paragonów</h1>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Skanowanie paragonów aparatem i automatyczna kategoryzacja AI pojawią się w kolejnym etapie
          (patrz plan, Etap 5). Na razie dodawaj wydatki ręcznie w zakładce „Dodaj”.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {rows.map((receipt) => (
            <li key={receipt.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="text-neutral-900">{receipt.storeName ?? "Paragon"}</p>
                <p className="text-xs text-neutral-400">
                  {receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("pl-PL") : "—"} ·{" "}
                  {receipt.status}
                </p>
              </div>
              {receipt.totalAmount != null && (
                <span className="font-medium text-neutral-900">{receipt.totalAmount} zł</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
