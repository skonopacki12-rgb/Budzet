import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface ActiveHousehold {
  id: string;
  name: string;
  currency: string;
  role: "owner" | "member";
}

export async function getActiveHousehold(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ActiveHousehold | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("role, households ( id, name, currency )")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.households) {
    return null;
  }

  const household = Array.isArray(data.households) ? data.households[0] : data.households;
  if (!household) return null;

  return {
    id: household.id,
    name: household.name,
    currency: household.currency,
    role: data.role,
  };
}
