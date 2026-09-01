"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
  const clearedCategoryIds: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("limit__cat__")) continue;
    const categoryId = key.replace("limit__cat__", "");
    const raw = String(value).replace(",", ".").trim();
    if (!raw) {
      clearedCategoryIds.push(categoryId);
      continue;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) continue;

    categoryRows.push({
      householdId: household.id,
      period: periodStart,
      categoryId,
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

  for (const categoryId of clearedCategoryIds) {
    await db
      .delete(budgets)
      .where(
        and(eq(budgets.householdId, household.id), eq(budgets.period, periodStart), eq(budgets.categoryId, categoryId)),
      );
  }

  revalidatePath("/budzet");
  revalidatePath("/");
  redirect("/budzet?saved=1");
}

export async function copyBudgetsFromPreviousMonth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const { periodStart } = monthPeriod();
  const now = new Date();
  const { periodStart: previousPeriodStart } = monthPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const [previousGlobal, previousCategoryBudgets] = await Promise.all([
    db
      .select({ limitAmount: monthlyBudgets.limitAmount })
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.householdId, household.id), eq(monthlyBudgets.period, previousPeriodStart)))
      .get(),
    db
      .select({ categoryId: budgets.categoryId, limitAmount: budgets.limitAmount })
      .from(budgets)
      .where(and(eq(budgets.householdId, household.id), eq(budgets.period, previousPeriodStart)))
      .all(),
  ]);

  if (!previousGlobal && previousCategoryBudgets.length === 0) {
    redirect("/budzet?copy_empty=1");
  }

  if (previousGlobal) {
    await db
      .insert(monthlyBudgets)
      .values({ householdId: household.id, period: periodStart, limitAmount: previousGlobal.limitAmount })
      .onConflictDoUpdate({
        target: [monthlyBudgets.householdId, monthlyBudgets.period],
        set: { limitAmount: previousGlobal.limitAmount },
      });
  }

  for (const row of previousCategoryBudgets) {
    await db
      .insert(budgets)
      .values({ householdId: household.id, period: periodStart, categoryId: row.categoryId, limitAmount: row.limitAmount })
      .onConflictDoUpdate({
        target: [budgets.householdId, budgets.period, budgets.categoryId],
        set: { limitAmount: row.limitAmount },
      });
  }

  revalidatePath("/budzet");
  revalidatePath("/");
  redirect("/budzet?copied=1");
}
