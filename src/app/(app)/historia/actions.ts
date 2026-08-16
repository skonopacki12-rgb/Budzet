"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { transactions } from "@/db/schema";

export async function deleteTransaction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const id = String(formData.get("id") ?? "");

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.householdId, household.id)));

  revalidatePath("/historia");
  revalidatePath("/");
  revalidatePath("/budzet");
}
