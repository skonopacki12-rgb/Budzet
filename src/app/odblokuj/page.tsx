import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requiresUnlock } from "@/lib/pin";
import { UnlockForm } from "@/components/UnlockForm";
import { unlock } from "./actions";

export default async function UnlockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  if (!(await requiresUnlock(db, user.id))) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Budżet domowy</h1>
        <p className="mt-1 text-sm text-neutral-500">Podaj PIN, żeby wrócić do budżetu.</p>
      </div>
      <UnlockForm action={unlock} />
    </main>
  );
}
