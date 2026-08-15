import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { households, householdInvites } from "@/db/schema";
import { acceptInvite, createHousehold, invitePartner } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const { invited } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);

  if (!household) {
    const pendingInvites = await db
      .select({ id: householdInvites.id, householdName: households.name })
      .from(householdInvites)
      .innerJoin(households, eq(households.id, householdInvites.householdId))
      .where(and(eq(householdInvites.status, "pending"), eq(householdInvites.email, user.email)))
      .all();

    if (pendingInvites.length > 0) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Masz zaproszenie</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Dołącz do wspólnego budżetu zamiast zakładać nowy.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="rounded-xl border border-neutral-200 p-4">
                <p className="text-sm font-medium text-neutral-900">{invite.householdName}</p>
                <form action={acceptInvite.bind(null, invite.id)} className="mt-3">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Dołącz
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Załóż budżet domowy</h1>
          <p className="mt-1 text-sm text-neutral-500">
            To wspólna przestrzeń na wydatki — możesz później zaprosić partnera.
          </p>
        </div>
        <form action={createHousehold} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Nazwa budżetu
            <input
              name="name"
              defaultValue="Nasz budżet"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white"
          >
            Utwórz i zacznij
          </button>
        </form>
      </main>
    );
  }

  const inviteAction = invitePartner.bind(null, household.id);

  const invites = await db
    .select({ id: householdInvites.id, email: householdInvites.email, status: householdInvites.status })
    .from(householdInvites)
    .where(eq(householdInvites.householdId, household.id))
    .orderBy(desc(householdInvites.createdAt))
    .all();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Zaproś partnera</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {household.name} — zaproszona osoba zobaczy wspólny budżet po zalogowaniu tym adresem e-mail.
        </p>
      </div>

      {invited && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Zaproszenie wysłane.
        </div>
      )}

      <form action={inviteAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          E-mail partnera
          <input
            type="email"
            name="email"
            required
            placeholder="partner@przyklad.pl"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white"
        >
          Wyślij zaproszenie
        </button>
      </form>

      {invites.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-neutral-600">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between">
              <span>{invite.email}</span>
              <span className="text-xs text-neutral-400">{invite.status}</span>
            </li>
          ))}
        </ul>
      )}

      <Link href="/" className="text-center text-sm text-neutral-500 underline">
        Przejdź do pulpitu
      </Link>
    </main>
  );
}
