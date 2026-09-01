import type { Category } from "@/db/schema";

/**
 * Manually-added expenses store the meaningful label in `shop`, with `note`
 * as an optional extra remark. Receipt-derived expenses are the other way
 * round: `shop` is just the store the receipt was scanned from (the same
 * for every line item), while `note` holds the actual item name — the
 * detail that makes itemized categorization useful. Prefer whichever field
 * is the more specific one for how the transaction was created.
 */
export function transactionLabel(
  transaction: { shop: string | null; note: string | null; receiptId: string | null },
  category: Category | undefined,
): string {
  const primary = transaction.receiptId
    ? transaction.note || transaction.shop
    : transaction.shop || transaction.note;
  return primary || category?.name || "Wydatek";
}
