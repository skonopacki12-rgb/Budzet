"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertHouseholdMember } from "@/lib/household";
import { households, householdMembers, householdInvites } from "@/db/schema";

export async function createHousehold(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim() || "Nasz budżet";

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await db.insert(households).values({ name }).returning({ id: households.id }).get();

  await db.insert(householdMembers).values({ householdId: household.id, userId: user.id, role: "owner" });

  redirect("/");
}

export async function acceptInvite(inviteId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const invite = await db
    .select({
      id: householdInvites.id,
      householdId: householdInvites.householdId,
      email: householdInvites.email,
      status: householdInvites.status,
    })
    .from(householdInvites)
    .where(eq(householdInvites.id, inviteId))
    .get();

  if (!invite) {
    throw new Error("Nie znaleziono zaproszenia.");
  }

  if (invite.status !== "pending" || invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("To zaproszenie nie jest dla Ciebie dostępne.");
  }

  await db.insert(householdMembers).values({ householdId: invite.householdId, userId: user.id, role: "member" });
  await db.update(householdInvites).set({ status: "accepted" }).where(eq(householdInvites.id, invite.id));

  redirect("/");
}

export async function invitePartner(householdId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  // Household RLS is gone now that we're off Postgres/Supabase, so this
  // membership check is what stops a crafted request from inviting someone
  // into a household the caller doesn't belong to.
  await assertHouseholdMember(db, user.id, householdId);

  await db.insert(householdInvites).values({ householdId, email, invitedBy: user.id });

  redirect("/onboarding?invited=1");
}
