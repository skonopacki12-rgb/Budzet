"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { destroyUserSession, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { clearPin, markUnlocked, resetUnlock, setPin, verifyPin } from "@/lib/pin";
import { pushSubscriptions } from "@/db/schema";

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

export async function subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nie zalogowano.");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) throw new Error("Brak gospodarstwa domowego.");

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      householdId: household.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userId: user.id, householdId: household.id },
    });
}

export async function unsubscribePush(endpoint: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Nie zalogowano.");

  const db = await getDb();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
}
