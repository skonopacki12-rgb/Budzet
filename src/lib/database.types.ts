// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Once the project is linked to a real Supabase instance, regenerate with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts
//
// These are `type` aliases rather than `interface`s on purpose: Supabase's
// generic client checks each table's Row/Insert/Update against
// Record<string, unknown>, and TypeScript only grants that implicit index
// signature to object type literals, not to interfaces.

export type HouseholdRole = "owner" | "member";
export type InviteStatus = "pending" | "accepted" | "revoked";
export type AccountType = "cash" | "bank" | "card";
export type ReceiptStatus = "queued" | "ocr" | "ai" | "ready" | "error";
export type RecurringCycle = "monthly" | "quarterly" | "yearly" | "custom_days";
export type TransactionType = "expense" | "income" | "transfer";

export type Household = {
  id: string;
  name: string;
  currency: string;
  created_at: string;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at: string;
};

export type HouseholdInvite = {
  id: string;
  household_id: string;
  email: string;
  invited_by: string;
  status: InviteStatus;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
};

export type Subcategory = {
  id: string;
  category_id: string;
  household_id: string | null;
  name: string;
  sort_order: number;
  created_by: string | null;
};

export type Account = {
  id: string;
  household_id: string;
  name: string;
  type: AccountType;
  created_at: string;
};

export type Transaction = {
  id: string;
  household_id: string;
  account_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  occurred_on: string;
  category_id: string | null;
  subcategory_id: string | null;
  shop: string | null;
  note: string | null;
  tags: string[];
  receipt_id: string | null;
  recurring_expense_id: string | null;
  created_by: string;
  created_at: string;
};

export type RecurringExpense = {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  cycle: RecurringCycle;
  custom_days: number | null;
  payment_day: number | null;
  payment_method: string | null;
  next_due_date: string;
  contract_end_date: string | null;
  active: boolean;
  created_at: string;
};

export type Receipt = {
  id: string;
  household_id: string;
  image_path: string;
  store_name: string | null;
  store_nip: string | null;
  purchase_date: string | null;
  total_amount: number | null;
  status: ReceiptStatus;
  raw_text: string | null;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
};

export type ReceiptItem = {
  id: string;
  receipt_id: string;
  raw_name: string;
  normalized_name: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number;
  category_id: string | null;
  subcategory_id: string | null;
  ai_confidence: number | null;
  confirmed: boolean;
  transaction_id: string | null;
  created_at: string;
};

export type MonthlyBudget = {
  id: string;
  household_id: string;
  period: string;
  limit_amount: number;
  created_at: string;
};

export type Budget = {
  id: string;
  household_id: string;
  period: string;
  category_id: string;
  limit_amount: number;
  created_at: string;
};

export type MerchantRule = {
  id: string;
  household_id: string;
  name_pattern: string;
  store_name: string | null;
  subcategory_id: string;
  source: "user" | "ai";
  created_at: string;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

// Only the relationships actually embedded via `.select()` in the app need
// to be declared here (see src/lib/household.ts and src/app/onboarding).
type HouseholdRelationship = [
  {
    foreignKeyName: "household_members_household_id_fkey";
    columns: ["household_id"];
    isOneToOne: false;
    referencedRelation: "households";
    referencedColumns: ["id"];
  },
];

export type Database = {
  public: {
    Tables: {
      households: Table<Household>;
      household_members: Table<HouseholdMember, HouseholdRelationship>;
      household_invites: Table<
        HouseholdInvite,
        [
          {
            foreignKeyName: "household_invites_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ]
      >;
      categories: Table<Category>;
      subcategories: Table<Subcategory>;
      accounts: Table<Account>;
      transactions: Table<Transaction>;
      recurring_expenses: Table<RecurringExpense>;
      receipts: Table<Receipt>;
      receipt_items: Table<ReceiptItem>;
      monthly_budgets: Table<MonthlyBudget>;
      budgets: Table<Budget>;
      merchant_rules: Table<MerchantRule>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
