import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { acceptInvite, createHousehold, invitePartner } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>;
}) {
  const { invited } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const household = await getActiveHousehold(supabase, user.id);

  if (!household) {
    const { data: pendingInvites } = user.email
      ? await supabase
          .from("household_invites")
          .select("id, email, households ( name )")
          .eq("status", "pending")
          .ilike("email", user.email)
      : { data: null };

    if (pendingInvites && pendingInvites.length > 0) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Masz zaproszenie</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Dołącz do wspólnego budżetu zamiast zakładać nowy.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map((invite) => {
              const householdInfo = Array.isArray(invite.households)
                ? invite.households[0]
                : invite.households;
              return (
                <li key={invite.id} className="rounded-xl border border-neutral-200 p-4">
                  <p className="text-sm font-medium text-neutral-900">
                    {householdInfo?.name ?? "Budżet domowy"}
                  </p>
                  <form action={acceptInvite.bind(null, invite.id)} className="mt-3">
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
                    >
                      Dołącz
                    </button>
                  </form>
                </li>
              );
            })}
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

  const { data: invites } = await supabase
    .from("household_invites")
    .select("id, email, status")
    .eq("household_id", household.id)
    .order("created_at", { ascending: false });

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

      {invites && invites.length > 0 && (
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
