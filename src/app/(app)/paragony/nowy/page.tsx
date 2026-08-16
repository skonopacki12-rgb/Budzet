import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { ReceiptUploadForm } from "@/components/ReceiptUploadForm";
import { uploadReceipt } from "./actions";

export default async function NewReceiptPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  return (
    <div className="pt-2">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Dodaj paragon</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Zrób zdjęcie paragonu — AI odczyta sklep, kwoty i pozycje, a Ty potwierdzisz kategorie przed zapisaniem.
      </p>
      <ReceiptUploadForm action={uploadReceipt} />
    </div>
  );
}
