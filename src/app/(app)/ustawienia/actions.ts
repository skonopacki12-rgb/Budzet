"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { destroyUserSession, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { clearPin, markUnlocked, resetUnlock, setPin, verifyPin } from "@/lib/pin";
import { households, householdMembers } from "@/db/schema";

const PIN_PATTERN = /^\d{4,6}$/;

export async function signOut() {
  await destroyUserSession();
  await resetUnlock();
  redirect("/login");
}

export async function savePin(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pin = String(formData.get("pin") ?? "");
  const pinConfirm = String(formData.get("pin_confirm") ?? "");

  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN musi mieć 4–6 cyfr.");
  }
  if (pin !== pinConfirm) {
    throw new Error("Podane kody PIN różnią się.");
  }

  const db = await getDb();
  await setPin(db, user.id, pin);
  await markUnlocked();

  revalidatePath("/ustawienia");
  redirect("/ustawienia?pin_saved=1");
}

export async function removePin(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentPin = String(formData.get("current_pin") ?? "");

  const db = await getDb();
  if (!(await verifyPin(db, user.id, currentPin))) {
    throw new Error("Nieprawidłowy PIN.");
  }

  await clearPin(db, user.id);

  revalidatePath("/ustawienia");
  redirect("/ustawienia?pin_removed=1");
}

export async function updateHouseholdName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Nazwa nie może być pusta.");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  await db.update(households).set({ name }).where(eq(households.id, household.id));

  revalidatePath("/ustawienia");
  redirect("/ustawienia?name_saved=1");
}

export async function removeMember(formData: FormData) {
  const memberUserId = String(formData.get("user_id") ?? "");
  if (!memberUserId) return;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  if (household.role !== "owner") {
    throw new Error("Tylko właściciel gospodarstwa może usuwać członków.");
  }
  if (memberUserId === user.id) {
    throw new Error("Nie możesz usunąć samego siebie.");
  }

  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, household.id), eq(householdMembers.userId, memberUserId)));

  revalidatePath("/ustawienia");
  redirect("/ustawienia?member_removed=1");
}
