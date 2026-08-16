"use server";

import { redirect } from "next/navigation";
import { asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { extractReceipt, type CategoryOption } from "@/lib/receiptAi";
import { categories, receipts, receiptItems, subcategories } from "@/db/schema";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function uploadReceipt(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Wybierz zdjęcie paragonu.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Zdjęcie jest za duże (limit 8 MB).");
  }

  const env = await getEnv();
  const receiptId = crypto.randomUUID();
  const imagePath = `${household.id}/${receiptId}.jpg`;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    await env.RECEIPTS.put(imagePath, bytes, {
      httpMetadata: { contentType: file.type || "image/jpeg" },
    });
    await db.insert(receipts).values({
      id: receiptId,
      householdId: household.id,
      imagePath,
      status: "ai",
      uploadedBy: user.id,
    });
  } catch {
    throw new Error("Nie udało się wgrać zdjęcia. Spróbuj ponownie za chwilę.");
  }

  const [categoryRows, subcategoryRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)).all(),
    db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId, name: subcategories.name })
      .from(subcategories)
      .where(or(isNull(subcategories.householdId), eq(subcategories.householdId, household.id)))
      .orderBy(asc(subcategories.sortOrder))
      .all(),
  ]);
  const categoryByName = new Map(categoryRows.map((category) => [category.name, category.id]));
  const subcategoryByCategoryId = new Map<string, Map<string, string>>();
  for (const sub of subcategoryRows) {
    if (!subcategoryByCategoryId.has(sub.categoryId)) subcategoryByCategoryId.set(sub.categoryId, new Map());
    subcategoryByCategoryId.get(sub.categoryId)!.set(sub.name, sub.id);
  }

  const categoryOptions: CategoryOption[] = categoryRows.map((category) => ({
    name: category.name,
    subcategories: subcategoryRows.filter((sub) => sub.categoryId === category.id).map((sub) => sub.name),
  }));

  if (!env.ANTHROPIC_API_KEY) {
    await db
      .update(receipts)
      .set({ status: "error", errorMessage: "Brak skonfigurowanego klucza API do analizy AI." })
      .where(eq(receipts.id, receiptId));
    redirect(`/paragony/${receiptId}`);
  }

  try {
    const extracted = await extractReceipt(env.ANTHROPIC_API_KEY, bytes, categoryOptions);

    await db
      .update(receipts)
      .set({
        storeName: extracted.storeName,
        purchaseDate: extracted.purchaseDate,
        totalAmount: extracted.totalAmount,
        rawText: JSON.stringify(extracted, null, 2),
        status: "ready",
      })
      .where(eq(receipts.id, receiptId));

    if (extracted.items.length > 0) {
      await db.insert(receiptItems).values(
        extracted.items.map((item) => {
          const categoryId = item.category ? (categoryByName.get(item.category) ?? null) : null;
          const subcategoryId =
            categoryId && item.subcategory ? (subcategoryByCategoryId.get(categoryId)?.get(item.subcategory) ?? null) : null;
          return {
            receiptId,
            rawName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            categoryId,
            subcategoryId,
          };
        }),
      );
    }
  } catch (error) {
    await db
      .update(receipts)
      .set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Nieznany błąd analizy AI.",
      })
      .where(eq(receipts.id, receiptId));
  }

  redirect(`/paragony/${receiptId}`);
}
