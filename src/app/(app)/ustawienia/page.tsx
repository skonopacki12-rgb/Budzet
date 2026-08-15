import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  const { count: memberCount } = await supabase
    .from("household_members")
    .select("*", { count: "exact", head: true })
    .eq("household_id", household.id);

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
          {memberCount ?? 1} {memberCount === 1 ? "osoba" : "osoby"} · waluta {household.currency}
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
