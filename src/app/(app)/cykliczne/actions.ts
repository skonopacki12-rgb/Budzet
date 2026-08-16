"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { addCycle, type RecurringCycle } from "@/lib/date";
import { recurringExpenses, transactions } from "@/db/schema";

const CYCLES: RecurringCycle[] = ["monthly", "quarterly", "yearly", "custom_days"];

export async function addRecurringExpense(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(String(formData.get("amount")).replace(",", "."));
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const cycleRaw = String(formData.get("cycle") ?? "monthly");
  const cycle = CYCLES.includes(cycleRaw as RecurringCycle) ? (cycleRaw as RecurringCycle) : "monthly";
  const customDaysRaw = String(formData.get("custom_days") ?? "").trim();
  const customDays = cycle === "custom_days" && customDaysRaw ? Number(customDaysRaw) : null;
  const nextDueDate = String(formData.get("next_due_date") ?? "");
  const contractEndDate = String(formData.get("contract_end_date") ?? "").trim() || null;
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() || null;

  if (!name) {
    throw new Error("Podaj nazwę wydatku cyklicznego.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Podaj poprawną kwotę.");
  }
  if (!nextDueDate) {
    throw new Error("Podaj datę pierwszej płatności.");
  }
  if (cycle === "custom_days" && (!customDays || customDays <= 0)) {
    throw new Error("Podaj liczbę dni dla cyklu niestandardowego.");
  }

  await db.insert(recurringExpenses).values({
    householdId: household.id,
    name,
    amount,
    categoryId,
    subcategoryId,
    cycle,
    customDays,
    nextDueDate,
    contractEndDate,
    paymentMethod,
  });

  revalidatePath("/cykliczne");
  redirect("/cykliczne?added=1");
}

export async function markRecurringExpensePaid(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const id = String(formData.get("id") ?? "");
  const recurring = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, household.id)))
    .get();

  if (!recurring) {
    throw new Error("Nie znaleziono wydatku cyklicznego.");
  }

  const today = new Date().toISOString().slice(0, 10);

  await db.insert(transactions).values({
    householdId: household.id,
    type: "expense",
    amount: recurring.amount,
    currency: household.currency,
    occurredOn: today,
    categoryId: recurring.categoryId,
    subcategoryId: recurring.subcategoryId,
    note: recurring.name,
    recurringExpenseId: recurring.id,
    createdBy: user.id,
  });

  const nextDueDate = addCycle(recurring.nextDueDate, recurring.cycle as RecurringCycle, recurring.customDays);
  const active = recurring.contractEndDate ? nextDueDate <= recurring.contractEndDate : true;

  await db.update(recurringExpenses).set({ nextDueDate, active }).where(eq(recurringExpenses.id, recurring.id));

  revalidatePath("/cykliczne");
  revalidatePath("/");
  redirect("/cykliczne?paid=1");
}

export async function toggleRecurringExpenseActive(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const id = String(formData.get("id") ?? "");
  const recurring = await db
    .select({ active: recurringExpenses.active })
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, household.id)))
    .get();

  if (!recurring) {
    throw new Error("Nie znaleziono wydatku cyklicznego.");
  }

  await db
    .update(recurringExpenses)
    .set({ active: !recurring.active })
    .where(eq(recurringExpenses.id, id));

  revalidatePath("/cykliczne");
}

export async function deleteRecurringExpense(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) redirect("/onboarding");

  const id = String(formData.get("id") ?? "");

  await db
    .delete(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, household.id)));

  revalidatePath("/cykliczne");
}
