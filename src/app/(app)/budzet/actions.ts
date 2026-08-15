"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { monthPeriod } from "@/lib/date";

export async function saveBudgets(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  const { periodStart } = monthPeriod();

  const globalRaw = String(formData.get("limit__global") ?? "").replace(",", ".").trim();
  if (globalRaw) {
    const globalAmount = Number(globalRaw);
    if (Number.isFinite(globalAmount) && globalAmount >= 0) {
      const { error } = await supabase
        .from("monthly_budgets")
        .upsert(
          { household_id: household.id, period: periodStart, limit_amount: globalAmount },
          { onConflict: "household_id,period" },
        );
      if (error) throw new Error(error.message);
    }
  }

  const categoryRows: { household_id: string; period: string; category_id: string; limit_amount: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("limit__cat__")) continue;
    const raw = String(value).replace(",", ".").trim();
    if (!raw) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) continue;

    categoryRows.push({
      household_id: household.id,
      period: periodStart,
      category_id: key.replace("limit__cat__", ""),
      limit_amount: amount,
    });
  }

  if (categoryRows.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .upsert(categoryRows, { onConflict: "household_id,period,category_id" });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/budzet");
  revalidatePath("/");
  redirect("/budzet?saved=1");
}
