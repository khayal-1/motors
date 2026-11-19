-- Phase: separate customer records from Supabase Auth identities.
-- Additive/backfill-only: preserve profile/request IDs and all existing rows.
-- Apply after 20261118180000, 20261118190000, and 20261118193000 are safely recorded/applied.
begin;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 240),
  first_name text not null default '' check (char_length(first_name) <= 80),
  middle_name text not null default '' check (char_length(middle_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 40),
  address text not null default '' check (char_length(address) <= 500),
  legal_data jsonb not null default '{}'::jsonb check (jsonb_typeof(legal_data) = 'object'),
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_phone_unique_idx on public.clients(phone) where phone is not null;
create index if not exists clients_created_at_idx on public.clients(created_at desc);
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

-- Backfill customer-only profiles and any pre-existing request owners. IDs in Auth,
-- profiles, and the request tables are not rewritten; existing profile values are copied.
insert into public.clients(user_id, name, first_name, middle_name, last_name, phone, address, legal_data, terms_accepted_at, terms_version, created_at, updated_at)
select p.id,
  coalesce(nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.middle_name), ''), nullif(trim(p.last_name), ''))), ''), nullif(trim(p.display_name), ''), ''),
  p.first_name, p.middle_name, p.last_name, p.phone, '', '{}'::jsonb, p.terms_accepted_at, p.terms_version, p.created_at, p.updated_at
from public.profiles p
join auth.users u on u.id = p.id
where (
  public.is_customer_profile(p.id)
  or exists (select 1 from public.purchase_requests pr where pr.customer_id = p.id)
  or exists (select 1 from public.import_requests ir where ir.customer_id = p.id)
)
on conflict (user_id) do nothing;

-- Once the full source values are present in clients, remove only the matching customer
-- copies from profiles. Staff profiles and any non-matching values are left untouched.
update public.profiles p set
  display_name = '', first_name = '', middle_name = '', last_name = '', phone = null,
  terms_accepted_at = null, terms_version = null
from public.clients c
where c.user_id = p.id
  and public.is_customer_profile(p.id)
  and c.first_name is not distinct from p.first_name
  and c.middle_name is not distinct from p.middle_name
  and c.last_name is not distinct from p.last_name
  and c.phone is not distinct from p.phone
  and c.terms_accepted_at is not distinct from p.terms_accepted_at
  and c.terms_version is not distinct from p.terms_version
  and c.name = coalesce(nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.middle_name), ''), nullif(trim(p.last_name), ''))), ''), nullif(trim(p.display_name), ''), '');

-- Preserve phone login for existing customers while sourcing the number from clients.
-- Abort rather than transfer a phone mapping if another Auth account already owns it.
do $$ begin
  if exists (
    select 1 from public.clients c join public.phone_login_index pli on pli.phone = c.phone
    where c.phone is not null and pli.user_id <> c.user_id
  ) then
    raise exception 'Customer phone conflicts with another phone-login account; reconcile before migration.' using errcode = '23505';
  end if;
end $$;
delete from public.phone_login_index pli using public.clients c
where pli.user_id = c.user_id and pli.phone is distinct from c.phone;
insert into public.phone_login_index(phone, user_id, login_email)
select c.phone, c.user_id, u.email from public.clients c
join auth.users u on u.id = c.user_id
where c.phone is not null and u.email is not null
on conflict (phone) do update set login_email = excluded.login_email;

-- Request ownership keeps its existing UUID values, now referencing the unique Auth
-- identity key on clients rather than the general-purpose profiles table.
alter table public.purchase_requests drop constraint if exists purchase_requests_customer_id_fkey;
alter table public.purchase_requests add constraint purchase_requests_customer_id_fkey
  foreign key (customer_id) references public.clients(user_id) on delete cascade not valid;
alter table public.purchase_requests validate constraint purchase_requests_customer_id_fkey;
alter table public.import_requests drop constraint if exists import_requests_customer_id_fkey;
alter table public.import_requests add constraint import_requests_customer_id_fkey
  foreign key (customer_id) references public.clients(user_id) on delete cascade not valid;
alter table public.import_requests validate constraint import_requests_customer_id_fkey;

alter table public.clients enable row level security;
revoke all on public.clients from public, anon, authenticated;
grant select, insert, update on public.clients to service_role;
grant select on public.clients to authenticated;
grant update (name, first_name, middle_name, last_name, address, legal_data) on public.clients to authenticated;
create policy "clients_read_self_or_authorized_staff" on public.clients for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_owner()
  or (public.has_permission('view_customers') and public.is_customer_profile(clients.user_id))
);
create policy "clients_update_self_or_authorized_staff" on public.clients for update to authenticated
using (
  user_id = (select auth.uid())
  or public.is_owner()
  or (public.has_permission('edit_customers') and public.is_customer_profile(clients.user_id))
)
with check (
  user_id = (select auth.uid())
  or public.is_owner()
  or (public.has_permission('edit_customers') and public.is_customer_profile(clients.user_id))
);

-- Customer identity details no longer belong in profiles; profiles remains the
-- Auth-linked operational record used by RBAC, audit attribution, and staff screens.
revoke update (first_name, middle_name, last_name, phone, terms_accepted_at, terms_version) on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- New Auth signups create an empty customer record transactionally. Personal details
-- are written by the server action to clients, not persisted in auth.users metadata.
create or replace function public.bootstrap_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  customer_role_id uuid;
  first_name_value text;
  middle_name_value text;
  last_name_value text;
  phone_value text;
  accepted_at_value timestamptz;
  terms_version_value text;
  account_type_value text;
  display_name_value text;
begin
  account_type_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'account_type'), ''), 'customer');
  if account_type_value not in ('customer','staff_invite','initial_owner') then
    raise exception 'Unsupported account type.' using errcode = '22023';
  end if;

  first_name_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), '');
  middle_name_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'middle_name'), ''), '');
  last_name_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), '');
  phone_value := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  if phone_value is null then phone_value := new.phone; end if;
  accepted_at_value := case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() else null end;
  terms_version_value := case when accepted_at_value is not null then nullif(trim(new.raw_user_meta_data ->> 'terms_version'), '') else null end;
  display_name_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), concat_ws(' ', nullif(first_name_value, ''), nullif(middle_name_value, ''), nullif(last_name_value, '')));

  if account_type_value in ('staff_invite','initial_owner') then
    if first_name_value = '' or middle_name_value = '' or last_name_value = '' or phone_value is null then
      raise exception 'Staff and Owner accounts require full name and phone.' using errcode = '22023';
    end if;
    if length(first_name_value) > 80 or length(middle_name_value) > 80 or length(last_name_value) > 80
      or length(phone_value) > 40 or phone_value !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'Invalid staff identity.' using errcode = '22023';
    end if;
    if accepted_at_value is not null and terms_version_value is null then
      raise exception 'Terms version is required for accepted consent.' using errcode = '22023';
    end if;
    if account_type_value = 'initial_owner' and (accepted_at_value is null or terms_version_value is null) then
      raise exception 'Owner provisioning requires policy acceptance.' using errcode = '22023';
    end if;
    insert into public.profiles (id, display_name, first_name, middle_name, last_name, phone, terms_accepted_at, terms_version)
    values (new.id, coalesce(nullif(display_name_value, ''), ''), first_name_value, middle_name_value, last_name_value, phone_value, accepted_at_value, terms_version_value)
    on conflict (id) do update set
      display_name = excluded.display_name, first_name = excluded.first_name,
      middle_name = excluded.middle_name, last_name = excluded.last_name,
      phone = coalesce(excluded.phone, public.profiles.phone),
      terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
      terms_version = coalesce(excluded.terms_version, public.profiles.terms_version);
  else
    insert into public.profiles (id, display_name) values (new.id, '') on conflict (id) do nothing;
    insert into public.clients (user_id) values (new.id) on conflict (user_id) do nothing;
    select id into customer_role_id from public.roles where key = 'customer';
    if customer_role_id is not null then
      insert into public.user_roles(user_id, role_id) values (new.id, customer_role_id) on conflict do nothing;
    end if;
  end if;

  if account_type_value in ('staff_invite','initial_owner') and phone_value is not null and new.email is not null then
    insert into public.phone_login_index(phone, user_id, login_email)
    values (phone_value, new.id, new.email)
    on conflict (phone) do update set login_email = excluded.login_email
    where public.phone_login_index.user_id = excluded.user_id;
    if not found then raise exception 'Phone number is already in use.' using errcode = '23505'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.bootstrap_new_user() from public, anon, authenticated;

-- Self-service changes are atomic and keep the private phone-login index in sync.
-- The Auth email remains solely in auth.users and is changed through Supabase Auth.
create or replace function public.update_my_client_profile(
  target_name text,
  target_first_name text,
  target_middle_name text,
  target_last_name text,
  target_phone text,
  target_address text
)
returns void language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
begin
  if current_user_id is null or not public.is_customer_profile(current_user_id) then
    raise exception 'Customer session required.' using errcode = '42501';
  end if;
  if target_name is null or char_length(trim(target_name)) < 3 or char_length(target_name) > 240
    or target_first_name is null or char_length(target_first_name) not between 1 and 80
    or target_middle_name is null or char_length(target_middle_name) not between 1 and 80
    or target_last_name is null or char_length(target_last_name) not between 1 and 80
    or target_address is null or char_length(target_address) > 500
    or (target_phone is not null and (char_length(target_phone) > 40 or target_phone !~ '^\+[1-9][0-9]{7,14}$')) then
    raise exception 'Invalid customer details.' using errcode = '22023';
  end if;
  if target_phone is not null and exists (
    select 1 from public.phone_login_index pli where pli.phone = target_phone and pli.user_id <> current_user_id
  ) then
    raise exception 'Phone number is already in use.' using errcode = '23505';
  end if;
  update public.clients set name = trim(target_name), first_name = trim(target_first_name),
    middle_name = trim(target_middle_name), last_name = trim(target_last_name),
    phone = target_phone, address = trim(target_address)
  where user_id = current_user_id;
  if not found then raise exception 'Customer record not found.' using errcode = '23503'; end if;

  delete from public.phone_login_index where user_id = current_user_id;
  select email into current_email from auth.users where id = current_user_id;
  if target_phone is not null and current_email is not null then
    insert into public.phone_login_index(phone, user_id, login_email)
    values (target_phone, current_user_id, current_email);
  end if;
end;
$$;
revoke all on function public.update_my_client_profile(text,text,text,text,text,text) from public, anon;
grant execute on function public.update_my_client_profile(text,text,text,text,text,text) to authenticated;

create or replace function public.sync_phone_login_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.phone_login_index set login_email = new.email where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_phone_login_email() from public, anon, authenticated;
drop trigger if exists auth_user_email_sync_phone_login on auth.users;
create trigger auth_user_email_sync_phone_login after update of email on auth.users
for each row execute function public.sync_phone_login_email();

-- Keep request UUID values and status/history intact while enforcing the new client link.
drop policy if exists "purchase_requests_read_customer_or_managed" on public.purchase_requests;
create policy "purchase_requests_read_client_or_managed" on public.purchase_requests for select to authenticated
using (
  (customer_id = (select auth.uid()) and exists (select 1 from public.clients c where c.user_id = purchase_requests.customer_id))
  or public.has_permission('manage_requests')
);
drop policy if exists "purchase_requests_create_customer_pending" on public.purchase_requests;
create policy "purchase_requests_create_client_pending" on public.purchase_requests for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (select 1 from public.clients c where c.user_id = (select auth.uid()))
  and public.is_customer_profile((select auth.uid()))
  and status = 'pending'
  and (motorcycle_id is null or exists (select 1 from public.public_motorcycle_catalog catalog where catalog.id = purchase_requests.motorcycle_id))
);
drop policy if exists "import_requests_read_customer_or_managed" on public.import_requests;
create policy "import_requests_read_client_or_managed" on public.import_requests for select to authenticated
using (
  (customer_id = (select auth.uid()) and exists (select 1 from public.clients c where c.user_id = import_requests.customer_id))
  or public.has_permission('manage_requests')
);
drop policy if exists "import_requests_create_customer_pending" on public.import_requests;
create policy "import_requests_create_client_pending" on public.import_requests for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (select 1 from public.clients c where c.user_id = (select auth.uid()))
  and public.is_customer_profile((select auth.uid()))
  and status = 'pending'
);

commit;
