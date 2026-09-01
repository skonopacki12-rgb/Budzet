import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/db";
import { getActiveHousehold } from "@/lib/household";
import { receipts } from "@/db/schema";

export async function GET(_request: Request, { params }: RouteContext<"/paragony/[id]/obraz">) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = await getDb();
  const household = await getActiveHousehold(db, user.id);
  if (!household) return new Response("Not found", { status: 404 });

  const receipt = await db
    .select({ imagePath: receipts.imagePath })
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.householdId, household.id)))
    .get();
  if (!receipt) return new Response("Not found", { status: 404 });

  const env = await getEnv();
  const object = await env.RECEIPTS.get(receipt.imagePath);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
