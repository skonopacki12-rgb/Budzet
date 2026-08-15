-- Budżet domowy — initial schema
-- Households, membership, categories, transactions, budgets, recurring
-- expenses, receipts and merchant rules for AI receipt categorization.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Households (a shared budget between partners / family members)
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nasz budżet',
  currency text not null default 'PLN',
  created_at timestamptz not null default now()
);

create type household_role as enum ('owner', 'member');

create table household_members (
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on household_members (user_id);

create type invite_status as enum ('pending', 'accepted', 'revoked');

create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id),
  status invite_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index household_invites_email_idx on household_invites (lower(email));

-- ---------------------------------------------------------------------------
-- Categories / subcategories
-- Categories are a closed system dictionary (see plan sekcja 2).
-- Subcategories are seeded system-wide (household_id is null) but a
-- household can add its own custom subcategories under an existing category.
-- ---------------------------------------------------------------------------

create table categories (
  id text primary key,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0
);

create table subcategories (
  id text primary key,
  category_id text not null references categories (id) on delete cascade,
  household_id uuid references households (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_by uuid references auth.users (id)
);

create index subcategories_category_id_idx on subcategories (category_id);
create index subcategories_household_id_idx on subcategories (household_id);

-- ---------------------------------------------------------------------------
-- Accounts (cash / bank / card) — manual balances only, no bank sync
-- ---------------------------------------------------------------------------

create type account_type as enum ('cash', 'bank', 'card');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  type account_type not null default 'cash',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Receipts + receipt items (created before transactions since transactions
-- can reference a receipt)
-- ---------------------------------------------------------------------------

create type receipt_status as enum ('queued', 'ocr', 'ai', 'ready', 'error');

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  image_path text not null,
  store_name text,
  store_nip text,
  purchase_date date,
  total_amount numeric(12, 2),
  status receipt_status not null default 'queued',
  raw_text text,
  error_message text,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index receipts_household_id_idx on receipts (household_id);

-- ---------------------------------------------------------------------------
-- Recurring expenses (subscriptions, rent, installments, ...)
-- ---------------------------------------------------------------------------

create type recurring_cycle as enum ('monthly', 'quarterly', 'yearly', 'custom_days');
create type recurring_status as enum ('paid', 'pending', 'overdue');

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null,
  category_id text references categories (id),
  subcategory_id text references subcategories (id),
  cycle recurring_cycle not null default 'monthly',
  custom_days int,
  payment_day int,
  payment_method text,
  next_due_date date not null,
  contract_end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index recurring_expenses_household_id_idx on recurring_expenses (household_id);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

create type transaction_type as enum ('expense', 'income', 'transfer');

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  account_id uuid references accounts (id) on delete set null,
  type transaction_type not null default 'expense',
  amount numeric(12, 2) not null,
  currency text not null default 'PLN',
  occurred_on date not null default current_date,
  category_id text references categories (id),
  subcategory_id text references subcategories (id),
  shop text,
  note text,
  tags text[] not null default '{}',
  receipt_id uuid references receipts (id) on delete set null,
  recurring_expense_id uuid references recurring_expenses (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index transactions_household_id_idx on transactions (household_id);
create index transactions_occurred_on_idx on transactions (occurred_on);
create index transactions_category_id_idx on transactions (category_id);

alter table receipts
  add column linked_transaction_count int not null default 0;

-- ---------------------------------------------------------------------------
-- Receipt items — one row per line item parsed off a receipt
-- ---------------------------------------------------------------------------

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  raw_name text not null,
  normalized_name text,
  quantity numeric(10, 3) not null default 1,
  unit_price numeric(12, 2),
  total_price numeric(12, 2) not null,
  category_id text references categories (id),
  subcategory_id text references subcategories (id),
  ai_confidence numeric(4, 3),
  confirmed boolean not null default false,
  transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index receipt_items_receipt_id_idx on receipt_items (receipt_id);

-- ---------------------------------------------------------------------------
-- Budgets — monthly limits, either the household-wide total (monthly_budgets)
-- or per category (budgets). Kept in separate tables because a nullable
-- category_id would defeat the upsert-friendly unique constraint (Postgres
-- treats NULLs as distinct, so "one global row per period" can't be a plain
-- unique index on a nullable column).
-- ---------------------------------------------------------------------------

create table monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  period date not null,
  limit_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (household_id, period)
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  period date not null,
  category_id text not null references categories (id) on delete cascade,
  limit_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (household_id, period, category_id)
);

create index budgets_household_id_period_idx on budgets (household_id, period);

-- ---------------------------------------------------------------------------
-- Merchant rules — "this item name at this store always maps to..."
-- learned from user corrections, used before calling the AI model again.
-- ---------------------------------------------------------------------------

create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name_pattern text not null,
  store_name text,
  subcategory_id text not null references subcategories (id),
  source text not null default 'user' check (source in ('user', 'ai')),
  created_at timestamptz not null default now(),
  unique (household_id, name_pattern, store_name)
);

create index merchant_rules_household_id_idx on merchant_rules (household_id);
