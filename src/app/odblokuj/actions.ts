"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { markUnlocked, verifyPin } from "@/lib/pin";

export type UnlockActionState = { error: string } | undefined;

export async function unlock(_prevState: UnlockActionState, formData: FormData): Promise<UnlockActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pin = String(formData.get("pin") ?? "");
  const db = await getDb();

  if (!(await verifyPin(db, user.id, pin))) {
    return { error: "Nieprawidłowy PIN." };
  }

  await markUnlocked();
  redirect("/");
}
