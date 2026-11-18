-- Phase: customer purchase and import requests.
-- Repository migration only: inspect the target and reconcile the prior manually-applied
-- foundation before applying this file. This file is NOT applied to the live Supabase project.
begin;

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  motorcycle_id uuid references public.motorcycles(id) on delete set null,
  message text not null default '' check (char_length(message) <= 1200),
  status text not null default 'pending' check (status in ('pending','in_review','approved','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_requests_message_trimmed check (message = trim(message))
);
create index purchase_requests_customer_created_idx on public.purchase_requests(customer_id, created_at desc);
create index purchase_requests_status_created_idx on public.purchase_requests(status, created_at desc);
create index purchase_requests_motorcycle_idx on public.purchase_requests(motorcycle_id) where motorcycle_id is not null;

create table public.import_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  desired_brand text check (desired_brand is null or (char_length(trim(desired_brand)) between 1 and 80)),
  desired_model text check (desired_model is null or (char_length(trim(desired_model)) between 1 and 100)),
  year_min smallint check (year_min is null or year_min between 1900 and 2200),
  year_max smallint check (year_max is null or year_max between 1900 and 2200),
  engine_cc_min integer check (engine_cc_min is null or engine_cc_min between 1 and 10000),
  engine_cc_max integer check (engine_cc_max is null or engine_cc_max between 1 and 10000),
  budget_min_egp numeric(12,2) check (budget_min_egp is null or budget_min_egp >= 0),
  budget_max_egp numeric(12,2) check (budget_max_egp is null or budget_max_egp >= 0),
  notes text not null default '' check (char_length(notes) <= 1600),
  status text not null default 'pending' check (status in ('pending','in_review','approved','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_requests_has_target check (desired_brand is not null or desired_model is not null),
  constraint import_requests_year_range check (year_min is null or year_max is null or year_min <= year_max),
  constraint import_requests_engine_range check (engine_cc_min is null or engine_cc_max is null or engine_cc_min <= engine_cc_max),
  constraint import_requests_budget_range check (budget_min_egp is null or budget_max_egp is null or budget_min_egp <= budget_max_egp),
  constraint import_requests_notes_trimmed check (notes = trim(notes))
);
create index import_requests_customer_created_idx on public.import_requests(customer_id, created_at desc);
create index import_requests_status_created_idx on public.import_requests(status, created_at desc);

create trigger purchase_requests_set_updated_at before update on public.purchase_requests
for each row execute function public.set_updated_at();
create trigger import_requests_set_updated_at before update on public.import_requests
for each row execute function public.set_updated_at();

alter table public.purchase_requests enable row level security;
alter table public.import_requests enable row level security;

create policy "purchase_requests_read_own_or_managed" on public.purchase_requests
for select to authenticated
using (customer_id = (select auth.uid()) or public.has_permission('manage_requests'));
create policy "purchase_requests_create_own_pending" on public.purchase_requests
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'pending'
  and (motorcycle_id is null or exists (
    select 1 from public.public_motorcycle_catalog catalog
    where catalog.id = purchase_requests.motorcycle_id
  ))
);
create policy "purchase_requests_update_managed" on public.purchase_requests
for update to authenticated
using (public.has_permission('manage_requests'))
with check (public.has_permission('manage_requests'));

create policy "import_requests_read_own_or_managed" on public.import_requests
for select to authenticated
using (customer_id = (select auth.uid()) or public.has_permission('manage_requests'));
create policy "import_requests_create_own_pending" on public.import_requests
for insert to authenticated
with check (customer_id = (select auth.uid()) and status = 'pending');
create policy "import_requests_update_managed" on public.import_requests
for update to authenticated
using (public.has_permission('manage_requests'))
with check (public.has_permission('manage_requests'));

revoke all on public.purchase_requests, public.import_requests from anon, authenticated, public;
grant select, insert, update on public.purchase_requests, public.import_requests to authenticated;

commit;
