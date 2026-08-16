import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { hasPinSet } from "@/lib/pin";
import { getCurrentMonthCostUsd } from "@/lib/anthropicUsage";
import { householdMembers, users } from "@/db/schema";
import { ConfirmButton } from "@/components/ConfirmButton";
import { removeMember, removePin, savePin, signOut, updateHouseholdName } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    pin_saved?: string;
    pin_removed?: string;
    name_saved?: string;
    member_removed?: string;
  }>;
}) {
  const { pin_saved: pinSaved, pin_removed: pinRemoved, name_saved: nameSaved, member_removed: memberRemoved } =
    await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const [memberRows, pinSet, env] = await Promise.all([
    db
      .select({ userId: householdMembers.userId, role: householdMembers.role, email: users.email })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, household.id))
      .orderBy(asc(householdMembers.joinedAt))
      .all(),
    hasPinSet(db, user.id),
    getEnv(),
  ]);

  let claudeUsageUsd: number | null = null;
  let claudeUsageError: string | null = null;
  if (env.ANTHROPIC_ADMIN_API_KEY) {
    try {
      claudeUsageUsd = await getCurrentMonthCostUsd(env.ANTHROPIC_ADMIN_API_KEY);
    } catch {
      claudeUsageError = "Nie udało się pobrać danych o zużyciu.";
    }
  } else {
    claudeUsageError = "Skonfiguruj sekret ANTHROPIC_ADMIN_API_KEY, żeby zobaczyć zużycie (patrz README).";
  }

  return (
    <div className="flex flex-col gap-6 pt-2 md:max-w-xl">
      <h1 className="text-xl font-semibold text-neutral-900">Ustawienia</h1>

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Zalogowano jako</p>
        <p className="font-medium text-neutral-900">{user.email}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Gospodarstwo domowe</p>
        {nameSaved && <p className="mt-1 text-sm text-emerald-700">Nazwa zapisana.</p>}
        <form action={updateHouseholdName} className="mt-1 flex items-center gap-2">
          <input
            name="name"
            defaultValue={household.name}
            required
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Zapisz
          </button>
        </form>
        <p className="mt-3 text-neutral-500">
          {memberRows.length} {memberRows.length === 1 ? "osoba" : "osoby"} · waluta {household.currency}
        </p>

        {memberRemoved && <p className="mt-2 text-sm text-emerald-700">Członek usunięty.</p>}

        <ul className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-3">
          {memberRows.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-neutral-800">
                {member.email}
                {member.role === "owner" && <span className="text-xs text-neutral-400"> (właściciel)</span>}
              </span>
              {household.role === "owner" && member.userId !== user.id && (
                <form action={removeMember} className="shrink-0">
                  <input type="hidden" name="user_id" value={member.userId} />
                  <ConfirmButton
                    confirmMessage={`Usunąć ${member.email} z gospodarstwa?`}
                    className="text-xs text-red-600 underline"
                  >
                    Usuń
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>

        <Link href="/onboarding" className="mt-3 inline-block text-sm text-neutral-700 underline">
          Zaproś partnera
        </Link>
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4 text-sm">
        <p className="text-xs text-neutral-400">Zużycie Claude (skan paragonów) w tym miesiącu</p>
        {claudeUsageError ? (
          <p className="mt-1 text-neutral-500">{claudeUsageError}</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold text-neutral-900">${claudeUsageUsd!.toFixed(2)}</p>
        )}
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
