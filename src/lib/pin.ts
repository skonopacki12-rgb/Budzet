import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";

const UNLOCK_COOKIE = "budzet_unlocked";

/** True once the user has entered their PIN correctly for this browser session (cleared when the browser closes). */
async function isUnlocked(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(UNLOCK_COOKIE)?.value === "1";
}

export async function markUnlocked() {
  const cookieStore = await cookies();
  cookieStore.set(UNLOCK_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge/expires: a session cookie, so re-opening the browser re-locks the app.
  });
}

/** Clears the unlock state — call on login/logout so a new account on the same device isn't left unlocked. */
export async function resetUnlock() {
  const cookieStore = await cookies();
  cookieStore.delete(UNLOCK_COOKIE);
}

export async function hasPinSet(db: Db, userId: string): Promise<boolean> {
  const row = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, userId)).get();
  return Boolean(row?.pinHash);
}

/** Whether the app should show the PIN lock screen for this user right now. */
export async function requiresUnlock(db: Db, userId: string): Promise<boolean> {
  if (!(await hasPinSet(db, userId))) return false;
  return !(await isUnlocked());
}

export async function setPin(db: Db, userId: string, pin: string): Promise<void> {
  const pinHash = await hashPassword(pin);
  await db.update(users).set({ pinHash }).where(eq(users.id, userId));
}

export async function clearPin(db: Db, userId: string): Promise<void> {
  await db.update(users).set({ pinHash: null }).where(eq(users.id, userId));
}

export async function verifyPin(db: Db, userId: string, pin: string): Promise<boolean> {
  const row = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, userId)).get();
  if (!row?.pinHash) return false;
  return verifyPassword(pin, row.pinHash);
}
