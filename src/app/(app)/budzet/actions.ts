"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod } from "@/lib/date";
import { budgets, monthlyBudgets } from "@/db/schema";

export async function saveBudgets(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const { periodStart } = monthPeriod();

  const globalRaw = String(formData.get("limit__global") ?? "").replace(",", ".").trim();
  if (globalRaw) {
    const globalAmount = Number(globalRaw);
    if (Number.isFinite(globalAmount) && globalAmount >= 0) {
      await db
        .insert(monthlyBudgets)
        .values({ householdId: household.id, period: periodStart, limitAmount: globalAmount })
        .onConflictDoUpdate({
          target: [monthlyBudgets.householdId, monthlyBudgets.period],
          set: { limitAmount: globalAmount },
        });
    }
  }

  const categoryRows: { householdId: string; period: string; categoryId: string; limitAmount: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("limit__cat__")) continue;
    const raw = String(value).replace(",", ".").trim();
    if (!raw) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) continue;

    categoryRows.push({
      householdId: household.id,
      period: periodStart,
      categoryId: key.replace("limit__cat__", ""),
      limitAmount: amount,
    });
  }

  for (const row of categoryRows) {
    await db
      .insert(budgets)
      .values(row)
      .onConflictDoUpdate({
        target: [budgets.householdId, budgets.period, budgets.categoryId],
        set: { limitAmount: row.limitAmount },
      });
  }

  revalidatePath("/budzet");
  revalidatePath("/");
  redirect("/budzet?saved=1");
}
