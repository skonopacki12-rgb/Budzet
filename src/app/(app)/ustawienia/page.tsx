import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { hasPinSet } from "@/lib/pin";
import { householdMembers } from "@/db/schema";
import { removePin, savePin, signOut } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pin_saved?: string; pin_removed?: string }>;
}) {
  const { pin_saved: pinSaved, pin_removed: pinRemoved } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const [memberCountRow, pinSet] = await Promise.all([
    db.select({ value: count() }).from(householdMembers).where(eq(householdMembers.householdId, household.id)).get(),
    hasPinSet(db, user.id),
  ]);
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

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Blokada kodem PIN</p>
        <p className="mt-1 text-neutral-500">
          {pinSet
            ? "Aplikacja poprosi o PIN po każdym ponownym otwarciu przeglądarki."
            : "Bez PIN-u każdy, kto ma dostęp do zalogowanej przeglądarki, zobaczy budżet."}
        </p>

        {pinSaved && <p className="mt-3 text-sm text-emerald-700">PIN zapisany.</p>}
        {pinRemoved && <p className="mt-3 text-sm text-emerald-700">PIN usunięty.</p>}

        <form action={savePin} className="mt-3 flex flex-col gap-2">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            placeholder={pinSet ? "Nowy PIN (4–6 cyfr)" : "PIN (4–6 cyfr)"}
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          />
          <input
            name="pin_confirm"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            placeholder="Powtórz PIN"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            {pinSet ? "Zmień PIN" : "Ustaw PIN"}
          </button>
        </form>

        {pinSet && (
          <form action={removePin} className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
            <input
              name="current_pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              placeholder="Obecny PIN, żeby usunąć blokadę"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600"
            >
              Usuń PIN
            </button>
          </form>
        )}
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
