"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { savingsGoals } from "@/db/schema";

export async function addSavingsGoal(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  const targetRaw = String(formData.get("target_amount") ?? "").replace(",", ".").trim();
  const targetDate = String(formData.get("target_date") ?? "").trim() || null;
  const targetAmount = Number(targetRaw);

  if (!name) throw new Error("Podaj nazwę celu.");
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new Error("Podaj poprawną kwotę celu.");

  await db.insert(savingsGoals).values({
    householdId: household.id,
    name,
    targetAmount,
    targetDate,
    createdBy: user.id,
  });

  revalidatePath("/cele");
  redirect("/cele?added=1");
}

export async function addContribution(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const goalId = String(formData.get("goal_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".").trim();
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Podaj poprawną kwotę.");

  const goal = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, household.id)))
    .get();
  if (!goal) throw new Error("Nie znaleziono celu.");

  const currentAmount = Math.max(goal.currentAmount + amount, 0);
  await db
    .update(savingsGoals)
    .set({ currentAmount, achieved: currentAmount >= goal.targetAmount })
    .where(eq(savingsGoals.id, goalId));

  revalidatePath("/cele");
  redirect("/cele");
}

export async function deleteSavingsGoal(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const goalId = String(formData.get("goal_id") ?? "");
  await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, household.id)));

  revalidatePath("/cele");
  redirect("/cele?deleted=1");
}
