import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

// ---------------------------------------------------------------------------
// Auth — our own email/password users + opaque session tokens, replacing
// Supabase Auth now that everything runs on Cloudflare.
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque random token, see src/lib/auth.ts
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);

// ---------------------------------------------------------------------------
// Households
// ---------------------------------------------------------------------------

export const households = sqliteTable("households", {
  id: id(),
  name: text("name").notNull().default("Nasz budżet"),
  currency: text("currency").notNull().default("PLN"),
  createdAt: createdAt(),
});

export const householdMembers = sqliteTable("household_members", {
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  joinedAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.householdId, table.userId] }),
  index("household_members_user_id_idx").on(table.userId),
]);

export const householdInvites = sqliteTable("household_invites", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
  createdAt: createdAt(),
}, (table) => [index("household_invites_email_idx").on(table.email)]);

// ---------------------------------------------------------------------------
// Categories / subcategories — closed system dictionary + per-household
// custom subcategories (see src/db/seed-categories.ts)
// ---------------------------------------------------------------------------

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const subcategories = sqliteTable("subcategories", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  householdId: text("household_id").references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
}, (table) => [
  index("subcategories_category_id_idx").on(table.categoryId),
  index("subcategories_household_id_idx").on(table.householdId),
]);

// ---------------------------------------------------------------------------
// Accounts (cash / bank / card) — manual balances only, no bank sync
// ---------------------------------------------------------------------------

export const accounts = sqliteTable("accounts", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["cash", "bank", "card"] }).notNull().default("cash"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Receipts + receipt items
// ---------------------------------------------------------------------------

export const receipts = sqliteTable("receipts", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  imagePath: text("image_path").notNull(),
  storeName: text("store_name"),
  storeNip: text("store_nip"),
  purchaseDate: text("purchase_date"),
  totalAmount: real("total_amount"),
  status: text("status", { enum: ["queued", "ocr", "ai", "ready", "error"] }).notNull().default("queued"),
  rawText: text("raw_text"),
  errorMessage: text("error_message"),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (table) => [index("receipts_household_id_idx").on(table.householdId)]);

export const receiptItems = sqliteTable("receipt_items", {
  id: id(),
  receiptId: text("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
  rawName: text("raw_name").notNull(),
  normalizedName: text("normalized_name"),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price"),
  totalPrice: real("total_price").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  subcategoryId: text("subcategory_id").references(() => subcategories.id),
  aiConfidence: real("ai_confidence"),
  confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
  transactionId: text("transaction_id"),
  createdAt: createdAt(),
}, (table) => [index("receipt_items_receipt_id_idx").on(table.receiptId)]);

// ---------------------------------------------------------------------------
// Recurring expenses
// ---------------------------------------------------------------------------

export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  subcategoryId: text("subcategory_id").references(() => subcategories.id),
  cycle: text("cycle", { enum: ["monthly", "quarterly", "yearly", "custom_days"] }).notNull().default("monthly"),
  customDays: integer("custom_days"),
  paymentDay: integer("payment_day"),
  paymentMethod: text("payment_method"),
  nextDueDate: text("next_due_date").notNull(),
  contractEndDate: text("contract_end_date"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
}, (table) => [index("recurring_expenses_household_id_idx").on(table.householdId)]);

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactions = sqliteTable("transactions", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  type: text("type", { enum: ["expense", "income", "transfer"] }).notNull().default("expense"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("PLN"),
  occurredOn: text("occurred_on").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  subcategoryId: text("subcategory_id").references(() => subcategories.id),
  shop: text("shop"),
  note: text("note"),
  receiptId: text("receipt_id").references(() => receipts.id, { onDelete: "set null" }),
  recurringExpenseId: text("recurring_expense_id").references(() => recurringExpenses.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (table) => [
  index("transactions_household_id_idx").on(table.householdId),
  index("transactions_occurred_on_idx").on(table.occurredOn),
  index("transactions_category_id_idx").on(table.categoryId),
]);

// ---------------------------------------------------------------------------
// Budgets — monthly_budgets holds the household-wide total, budgets holds
// the optional per-category limits (kept separate so "one global row per
// period" can be a plain unique index — see the equivalent note that used
// to live in the Postgres migration).
// ---------------------------------------------------------------------------

export const monthlyBudgets = sqliteTable("monthly_budgets", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  limitAmount: real("limit_amount").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("monthly_budgets_household_period_idx").on(table.householdId, table.period)]);

export const budgets = sqliteTable("budgets", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  limitAmount: real("limit_amount").notNull(),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("budgets_household_period_category_idx").on(table.householdId, table.period, table.categoryId),
]);

// ---------------------------------------------------------------------------
// Merchant rules — "this item name at this store always maps to..."
// ---------------------------------------------------------------------------

export const merchantRules = sqliteTable("merchant_rules", {
  id: id(),
  householdId: text("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  namePattern: text("name_pattern").notNull(),
  storeName: text("store_name"),
  subcategoryId: text("subcategory_id").notNull().references(() => subcategories.id),
  source: text("source", { enum: ["user", "ai"] }).notNull().default("user"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("merchant_rules_household_pattern_store_idx").on(
    table.householdId,
    table.namePattern,
    table.storeName,
  ),
  index("merchant_rules_household_id_idx").on(table.householdId),
]);

export type User = typeof users.$inferSelect;
export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type MerchantRule = typeof merchantRules.$inferSelect;
