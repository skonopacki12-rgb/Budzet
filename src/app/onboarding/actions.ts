"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createHousehold(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Nasz budżet";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: household, error } = await supabase
    .from("households")
    .insert({ name })
    .select("id")
    .single();

  if (error || !household) {
    throw new Error(error?.message ?? "Nie udało się utworzyć gospodarstwa domowego.");
  }

  const { error: memberError } = await supabase
    .from("household_members")
    .insert({ household_id: household.id, user_id: user.id, role: "owner" });

  if (memberError) {
    throw new Error(memberError.message);
  }

  redirect("/");
}

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: invite, error: inviteError } = await supabase
    .from("household_invites")
    .select("id, household_id, email, status")
    .eq("id", inviteId)
    .single();

  if (inviteError || !invite) {
    throw new Error("Nie znaleziono zaproszenia.");
  }

  if (invite.status !== "pending" || invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error("To zaproszenie nie jest dla Ciebie dostępne.");
  }

  const { error: memberError } = await supabase
    .from("household_members")
    .insert({ household_id: invite.household_id, user_id: user.id, role: "member" });

  if (memberError) {
    throw new Error(memberError.message);
  }

  await supabase.from("household_invites").update({ status: "accepted" }).eq("id", invite.id);

  redirect("/");
}

export async function invitePartner(householdId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("household_invites")
    .insert({ household_id: householdId, email, invited_by: user.id });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/onboarding?invited=1");
}
