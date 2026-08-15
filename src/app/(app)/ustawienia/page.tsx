import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { householdMembers } from "@/db/schema";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const memberCountRow = await db
    .select({ value: count() })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, household.id))
    .get();
  const memberCount = memberCountRow?.value ?? 1;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-xl font-semibold text-neutral-900">Ustawienia</h1>

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Zalogowano jako</p>
        <p className="font-medium text-neutral-900">{user.email}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Gospodarstwo domowe</p>
        <p className="font-medium text-neutral-900">{household.name}</p>
        <p className="mt-1 text-neutral-500">
          {memberCount} {memberCount === 1 ? "osoba" : "osoby"} · waluta {household.currency}
        </p>
        <Link href="/onboarding" className="mt-3 inline-block text-sm text-neutral-700 underline">
          Zaproś partnera
        </Link>
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-800"
        >
          Wyloguj się
        </button>
      </form>
    </div>
  );
}
