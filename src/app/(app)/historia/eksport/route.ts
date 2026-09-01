import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { categories, subcategories, transactions } from "@/db/schema";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) return new Response("Brak gospodarstwa domowego.", { status: 404 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const categoryId = searchParams.get("category_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(transactions.householdId, household.id), eq(transactions.type, "expense")];
  if (q?.trim()) {
    const pattern = `%${q.trim()}%`;
    conditions.push(or(like(transactions.shop, pattern), like(transactions.note, pattern))!);
  }
  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId));
  }
  if (from) {
    conditions.push(gte(transactions.occurredOn, from));
  }
  if (to) {
    conditions.push(lte(transactions.occurredOn, to));
  }

  const [rows, categoryRows, subcategoryRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .all(),
    db.select().from(categories).all(),
    db.select().from(subcategories).all(),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const subcategoryById = new Map(subcategoryRows.map((sub) => [sub.id, sub]));

  const header = ["Data", "Kwota", "Waluta", "Kategoria", "Podkategoria", "Sklep", "Notatka", "Zbędny"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.occurredOn,
        row.amount.toString(),
        row.currency,
        categoryById.get(row.categoryId ?? "")?.name ?? "",
        subcategoryById.get(row.subcategoryId ?? "")?.name ?? "",
        row.shop ?? "",
        row.note ?? "",
        row.unnecessary ? "Tak" : "Nie",
      ]
        .map((field) => csvEscape(String(field)))
        .join(","),
    );
  }

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wydatki-${today}.csv"`,
    },
  });
}
