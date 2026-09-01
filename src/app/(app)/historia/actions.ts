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
  revalidatePath("/statystyki");
}

export async function toggleUnnecessary(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const id = String(formData.get("id") ?? "");
  const next = formData.get("next") === "1";

  await db
    .update(transactions)
    .set({ unnecessary: next })
    .where(and(eq(transactions.id, id), eq(transactions.householdId, household.id)));

  revalidatePath("/historia");
  revalidatePath("/");
  revalidatePath("/budzet");
  revalidatePath("/statystyki");
}

export async function updateTransaction(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const amount = Number(String(formData.get("amount")).replace(",", "."));
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const shop = String(formData.get("shop") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Podaj poprawną kwotę.");
  }
  if (!occurredOn) {
    throw new Error("Podaj datę wydatku.");
  }

  await db
    .update(transactions)
    .set({ amount, occurredOn, categoryId, subcategoryId, shop, note })
    .where(and(eq(transactions.id, id), eq(transactions.householdId, household.id)));

  revalidatePath("/historia");
  revalidatePath("/");
  revalidatePath("/budzet");
  revalidatePath("/statystyki");
  redirect("/historia?edited=1");
}
