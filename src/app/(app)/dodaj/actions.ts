"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { transactions } from "@/db/schema";

export async function addExpense(formData: FormData) {
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

  await db.insert(transactions).values({
    householdId: household.id,
    type: "expense",
    amount,
    currency: household.currency,
    occurredOn,
    categoryId,
    subcategoryId,
    shop,
    note,
    createdBy: user.id,
  });

  revalidatePath("/");
  redirect("/?added=1");
}
