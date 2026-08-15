-- Row Level Security: every household only sees its own data.

create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

-- households --------------------------------------------------------------

alter table households enable row level security;

create policy "members can view their household"
  on households for select
  using (is_household_member(id));

create policy "authenticated users can create a household"
  on households for insert
  with check (auth.uid() is not null);

create policy "owners can update their household"
  on households for update
  using (is_household_member(id));

-- household_members --------------------------------------------------------

alter table household_members enable row level security;

create policy "members can view fellow members"
  on household_members for select
  using (is_household_member(household_id));

create policy "members can add themselves (accepting an invite)"
  on household_members for insert
  with check (user_id = auth.uid());

create policy "a member can leave their household"
  on household_members for delete
  using (user_id = auth.uid());

-- household_invites --------------------------------------------------------

alter table household_invites enable row level security;

create policy "members can view invites for their household"
  on household_invites for select
  using (
    is_household_member(household_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "members can create invites for their household"
  on household_invites for insert
  with check (is_household_member(household_id));

create policy "members can update invites for their household"
  on household_invites for update
  using (
    is_household_member(household_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- categories / subcategories ------------------------------------------------

alter table categories enable row level security;

create policy "any authenticated user can read the category dictionary"
  on categories for select
  using (auth.uid() is not null);

alter table subcategories enable row level security;

create policy "any authenticated user can read system subcategories, members read their own"
  on subcategories for select
  using (household_id is null or is_household_member(household_id));

create policy "members can add custom subcategories for their household"
  on subcategories for insert
  with check (household_id is not null and is_household_member(household_id));

-- accounts -------------------------------------------------------------------

alter table accounts enable row level security;

create policy "members can manage their household accounts"
  on accounts for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- transactions ----------------------------------------------------------------

alter table transactions enable row level security;

create policy "members can manage their household transactions"
  on transactions for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- recurring_expenses -----------------------------------------------------------

alter table recurring_expenses enable row level security;

create policy "members can manage their household recurring expenses"
  on recurring_expenses for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- monthly_budgets / budgets -------------------------------------------------------

alter table monthly_budgets enable row level security;

create policy "members can manage their household monthly budget"
  on monthly_budgets for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

alter table budgets enable row level security;

create policy "members can manage their household budgets"
  on budgets for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- receipts -------------------------------------------------------------------------

alter table receipts enable row level security;

create policy "members can manage their household receipts"
  on receipts for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- receipt_items ---------------------------------------------------------------------

alter table receipt_items enable row level security;

create policy "members can manage line items of their household receipts"
  on receipt_items for all
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_items.receipt_id
        and is_household_member(r.household_id)
    )
  );

-- merchant_rules ------------------------------------------------------------------------

alter table merchant_rules enable row level security;

create policy "members can manage their household merchant rules"
  on merchant_rules for all
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Storage: private bucket for receipt photos, one folder per household -------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "members can read their household receipt photos"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "members can upload receipt photos for their household"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "members can delete their household receipt photos"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );
