"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { receipts, receiptItems, transactions } from "@/db/schema";

export async function confirmReceipt(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const receiptId = String(formData.get("receipt_id") ?? "");
  const receipt = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.householdId, household.id)))
    .get();
  if (!receipt) {
    throw new Error("Nie znaleziono paragonu.");
  }

  const items = await db.select().from(receiptItems).where(eq(receiptItems.receiptId, receiptId)).all();

  for (const item of items) {
    if (item.confirmed) continue;

    const included = formData.get(`item__${item.id}__include`) === "on";
    if (!included) {
      await db.delete(receiptItems).where(eq(receiptItems.id, item.id));
      continue;
    }

    const categoryId = String(formData.get(`item__${item.id}__category_id`) ?? "") || null;
    const subcategoryId = String(formData.get(`item__${item.id}__subcategory_id`) ?? "") || null;
    const priceRaw = String(formData.get(`item__${item.id}__total_price`) ?? "").replace(",", ".");
    const totalPrice = Number(priceRaw);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      throw new Error(`Podaj poprawną kwotę dla pozycji „${item.rawName}”.`);
    }

    const transaction = await db
      .insert(transactions)
      .values({
        householdId: household.id,
        type: "expense",
        amount: totalPrice,
        currency: household.currency,
        occurredOn: receipt.purchaseDate ?? new Date().toISOString().slice(0, 10),
        categoryId,
        subcategoryId,
        shop: receipt.storeName,
        note: item.rawName,
        receiptId: receipt.id,
        createdBy: user.id,
      })
      .returning({ id: transactions.id })
      .get();

    await db
      .update(receiptItems)
      .set({ categoryId, subcategoryId, totalPrice, confirmed: true, transactionId: transaction.id })
      .where(eq(receiptItems.id, item.id));
  }

  revalidatePath(`/paragony/${receiptId}`);
  revalidatePath("/paragony");
  revalidatePath("/");
  redirect(`/paragony/${receiptId}?confirmed=1`);
}

export async function deleteReceipt(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const receiptId = String(formData.get("receipt_id") ?? "");
  const receipt = await db
    .select({ id: receipts.id, imagePath: receipts.imagePath })
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.householdId, household.id)))
    .get();
  if (!receipt) {
    throw new Error("Nie znaleziono paragonu.");
  }

  const env = await getEnv();
  await env.RECEIPTS.delete(receipt.imagePath);
  await db.delete(receipts).where(eq(receipts.id, receiptId));

  revalidatePath("/paragony");
  redirect("/paragony?deleted=1");
}
