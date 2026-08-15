import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveHousehold } from "@/lib/household";
import { ExpenseForm } from "@/components/ExpenseForm";
import { addExpense } from "./actions";

export default async function AddExpensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const household = await getActiveHousehold(supabase, user.id);
  if (!household) redirect("/onboarding");

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("subcategories")
      .select("*")
      .or(`household_id.is.null,household_id.eq.${household.id}`)
      .order("sort_order"),
  ]);

  return (
    <div className="pt-2">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Dodaj wydatek</h1>
      <ExpenseForm categories={categories ?? []} subcategories={subcategories ?? []} action={addExpense} />
    </div>
  );
}
