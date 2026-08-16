"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyUserSession, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clearPin, markUnlocked, resetUnlock, setPin, verifyPin } from "@/lib/pin";

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
