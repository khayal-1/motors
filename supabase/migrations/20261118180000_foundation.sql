-- Phase 1: initial relational foundation, extensible RBAC, inventory base, and RLS.
-- Apply through Supabase CLI/db push only after reviewing the target project.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  name_ar text not null,
  name_en text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,95}$'),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles(role_id);
create index role_permissions_permission_idx on public.role_permissions(permission_id);

create table public.motorcycles (
  id uuid primary key default gen_random_uuid(),
  stock_code text not null unique,
  brand text not null,
  model text not null,
  year smallint not null check (year between 1900 and 2200),
  color text,
  engine_cc integer check (engine_cc is null or engine_cc > 0),
  engine_type text,
  engine_number text not null,
  chassis_number text not null,
  price numeric(12,2) not null check (price >= 0),
  purchase_cost numeric(12,2) not null check (purchase_cost >= 0),
  description text not null default '',
  status text not null default 'Available' check (status in ('Available','Reserved','Sold','Maintenance','Imported','Coming Soon','Hidden','Archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint motorcycles_stock_code_nonempty check (length(trim(stock_code)) > 0),
  constraint motorcycles_engine_nonempty check (length(regexp_replace(engine_number, '[^[:alnum:]]', '', 'g')) > 0),
  constraint motorcycles_chassis_nonempty check (length(regexp_replace(chassis_number, '[^[:alnum:]]', '', 'g')) > 0)
);
create unique index motorcycles_chassis_normalized_uidx
  on public.motorcycles (upper(regexp_replace(chassis_number, '[^[:alnum:]]', '', 'g')));
create unique index motorcycles_engine_normalized_uidx
  on public.motorcycles (upper(regexp_replace(engine_number, '[^[:alnum:]]', '', 'g')));
create index motorcycles_catalog_idx on public.motorcycles (status, created_at desc);
create index motorcycles_search_brand_model_idx on public.motorcycles (lower(brand), lower(model));
create index motorcycles_search_year_idx on public.motorcycles (year);
create index motorcycles_price_idx on public.motorcycles (price);

create table public.motorcycle_media (
  id uuid primary key default gen_random_uuid(),
  motorcycle_id uuid not null references public.motorcycles(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','document')),
  provider text not null default 'placeholder' check (length(trim(provider)) > 0),
  provider_file_id text,
  provider_message_id text,
  file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index motorcycle_media_motorcycle_order_idx on public.motorcycle_media(motorcycle_id, sort_order, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_created_idx on public.audit_logs(entity, entity_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger motorcycles_set_updated_at before update on public.motorcycles
for each row execute function public.set_updated_at();

-- SECURITY DEFINER avoids recursive reads through user_roles RLS; caller can only ask
-- whether the current authenticated identity holds one explicitly granted permission.
create or replace function public.has_permission(permission_key text)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.key = permission_key
  );
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.bootstrap_new_user()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare customer_role_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''))
  on conflict (id) do nothing;
  select id into customer_role_id from public.roles where key = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles(user_id, role_id) values (new.id, customer_role_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.bootstrap_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.bootstrap_new_user();

insert into public.roles (key, name_ar, name_en, is_system) values
  ('customer', 'عميل', 'Customer', true),
  ('employee', 'موظف', 'Employee', true),
  ('manager', 'مدير', 'Manager', true),
  ('owner', 'صاحب المعرض', 'Owner', true),
  ('admin', 'مسؤول النظام', 'Admin', true),
  ('sales_employee', 'موظف مبيعات', 'Sales Employee', true),
  ('inventory_employee', 'موظف مخزون', 'Inventory Employee', true),
  ('cashier', 'أمين خزينة', 'Cashier', true)
on conflict (key) do nothing;

insert into public.permissions (key, description) values
  ('view_dashboard','View staff dashboard'),
  ('view_motorcycles','View inventory records'),
  ('create_motorcycles','Create inventory records'),
  ('edit_motorcycles','Edit inventory records'),
  ('delete_motorcycles','Soft-delete/archive inventory records'),
  ('view_sales','View sales'),
  ('create_sales','Create a sale transaction'),
  ('cancel_sales','Cancel a sale with an audited workflow'),
  ('view_customers','View customer records'),
  ('edit_customers','Edit customer records'),
  ('view_cashier','View cash transactions'),
  ('create_cash_transaction','Record cash transactions'),
  ('view_reports','View reports'),
  ('manage_users','Manage staff and role assignments'),
  ('manage_permissions','Manage role permissions'),
  ('manage_requests','Process customer purchase/import requests'),
  ('moderate_reviews','Moderate customer comments and ratings')
on conflict (key) do nothing;

-- Starter least-privilege mappings; Owner/Admin assignments remain manual and audited.
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'sales_employee' and p.key in ('view_dashboard','view_motorcycles','view_sales','create_sales','view_customers','manage_requests')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'inventory_employee' and p.key in ('view_dashboard','view_motorcycles','create_motorcycles','edit_motorcycles')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'cashier' and p.key in ('view_dashboard','view_sales','view_cashier','create_cash_transaction')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'manager' and p.key not in ('manage_permissions')
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('owner','admin')
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.motorcycles enable row level security;
alter table public.motorcycle_media enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_read_self_or_staff" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_permission('view_customers'));
create policy "profiles_update_self_or_staff" on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.has_permission('edit_customers'))
with check (id = (select auth.uid()) or public.has_permission('edit_customers'));
create policy "permissions_read_authenticated" on public.permissions for select to authenticated using (true);
create policy "permissions_manage_by_permission" on public.permissions for all to authenticated
using (public.has_permission('manage_permissions')) with check (public.has_permission('manage_permissions'));
create policy "roles_read_authenticated" on public.roles for select to authenticated using (true);
create policy "roles_manage_by_permission" on public.roles for all to authenticated
using (public.has_permission('manage_permissions')) with check (public.has_permission('manage_permissions'));
create policy "role_permissions_read_authenticated" on public.role_permissions for select to authenticated using (true);
create policy "role_permissions_manage_by_permission" on public.role_permissions for all to authenticated
using (public.has_permission('manage_permissions')) with check (public.has_permission('manage_permissions'));
create policy "user_roles_read_self_or_admin" on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.has_permission('manage_users'));
create policy "user_roles_manage_by_permission" on public.user_roles for all to authenticated
using (public.has_permission('manage_users')) with check (public.has_permission('manage_users'));
create policy "motorcycles_read_staff" on public.motorcycles for select to authenticated
using (public.has_permission('view_motorcycles'));
create policy "motorcycles_create_by_permission" on public.motorcycles for insert to authenticated
with check (public.has_permission('create_motorcycles'));
create policy "motorcycles_update_by_permission" on public.motorcycles for update to authenticated
using (public.has_permission('edit_motorcycles'))
with check (public.has_permission('edit_motorcycles'));
create policy "motorcycle_media_read_staff" on public.motorcycle_media for select to authenticated
using (public.has_permission('view_motorcycles'));
create policy "motorcycle_media_create_staff" on public.motorcycle_media for insert to authenticated
with check (public.has_permission('create_motorcycles'));
create policy "motorcycle_media_update_staff" on public.motorcycle_media for update to authenticated
using (public.has_permission('edit_motorcycles'))
with check (public.has_permission('edit_motorcycles'));
create policy "audit_logs_read_authorized" on public.audit_logs for select to authenticated
using (public.has_permission('view_reports') or public.has_permission('manage_users'));
-- No client INSERT/UPDATE/DELETE policies on audit_logs: writes will be added via trusted DB functions/triggers.

-- Public catalog is a column-limited view: never exposes acquisition cost or serial identifiers.
create view public.public_motorcycle_catalog with (security_barrier = true) as
select id, stock_code, brand, model, year, color, engine_cc, engine_type, price, description, status, created_at
from public.motorcycles
where status in ('Available','Coming Soon');
grant select on public.public_motorcycle_catalog to anon, authenticated;

-- Clear any broad defaults before granting only the intended Data API operations.
revoke all on public.profiles, public.roles, public.permissions, public.role_permissions,
  public.user_roles, public.motorcycles, public.motorcycle_media, public.audit_logs
  from anon, public;

-- Explicit API grants accompany RLS; no table-level privilege is granted to anon.
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update on public.motorcycles, public.motorcycle_media to authenticated;
grant select on public.audit_logs to authenticated;

commit;
