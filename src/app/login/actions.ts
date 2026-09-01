"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { createUserSession, hashPassword, verifyPassword } from "@/lib/auth";
import { resetUnlock } from "@/lib/pin";

export type AuthActionState = { error: string } | undefined;

export async function login(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Podaj e-mail i hasło." };
  }

  const db = await getDb();
  const user = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Nieprawidłowy e-mail lub hasło." };
  }

  await createUserSession(user.id);
  await resetUnlock();
  redirect("/");
}

export async function signup(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Podaj e-mail i hasło." };
  }
  if (password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }

  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) {
    return { error: "Konto z tym adresem e-mail już istnieje." };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id }).get();

  await createUserSession(user.id);
  await resetUnlock();
  redirect("/onboarding");
}
