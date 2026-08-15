import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, store_name, purchase_date, total_amount, status")
    .eq("household_id", household.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-xl font-semibold text-neutral-900">Archiwum paragonów</h1>

      {!receipts || receipts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
          Skanowanie paragonów aparatem i automatyczna kategoryzacja AI pojawią się w kolejnym etapie
          (patrz plan, Etap 5). Na razie dodawaj wydatki ręcznie w zakładce „Dodaj”.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100">
          {receipts.map((receipt) => (
            <li key={receipt.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="text-neutral-900">{receipt.store_name ?? "Paragon"}</p>
                <p className="text-xs text-neutral-400">
                  {receipt.purchase_date ? new Date(receipt.purchase_date).toLocaleDateString("pl-PL") : "—"} ·{" "}
                  {receipt.status}
                </p>
              </div>
              {receipt.total_amount != null && (
                <span className="font-medium text-neutral-900">{receipt.total_amount} zł</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
