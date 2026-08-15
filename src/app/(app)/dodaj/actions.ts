"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";

export async function addExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
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

  const { error } = await supabase.from("transactions").insert({
    household_id: household.id,
    type: "expense",
    amount,
    currency: household.currency,
    occurred_on: occurredOn,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    shop,
    note,
    created_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/?added=1");
}
