"use server";

import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { extractReceipt } from "@/lib/receiptAi";
import { categories, receipts, receiptItems } from "@/db/schema";

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
  const bytes = new Uint8Array(await file.arrayBuffer());

  const receiptId = crypto.randomUUID();
  const imagePath = `${household.id}/${receiptId}.jpg`;

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

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder))
    .all();
  const categoryByName = new Map(categoryRows.map((category) => [category.name, category.id]));

  try {
    const extracted = await extractReceipt(
      env.AI,
      bytes,
      categoryRows.map((category) => category.name),
    );

    await db
      .update(receipts)
      .set({
        storeName: extracted.storeName,
        purchaseDate: extracted.purchaseDate,
        totalAmount: extracted.totalAmount,
        status: "ready",
      })
      .where(eq(receipts.id, receiptId));

    if (extracted.items.length > 0) {
      await db.insert(receiptItems).values(
        extracted.items.map((item) => ({
          receiptId,
          rawName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          categoryId: item.category ? (categoryByName.get(item.category) ?? null) : null,
        })),
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
