import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { householdMembers, households } from "@/db/schema";

export interface ActiveHousehold {
  id: string;
  name: string;
  currency: string;
  role: "owner" | "member";
}

export async function getActiveHousehold(db: Db, userId: string): Promise<ActiveHousehold | null> {
  const row = await db
    .select({
      id: households.id,
      name: households.name,
      currency: households.currency,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.joinedAt))
    .get();

  return row ?? null;
}

/** Throws unless `userId` belongs to `householdId` — the manual replacement for what Postgres RLS used to enforce. */
export async function assertHouseholdMember(db: Db, userId: string, householdId: string): Promise<void> {
  const row = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
    .get();

  if (!row) {
    throw new Error("Brak dostępu do tego gospodarstwa domowego.");
  }
}
