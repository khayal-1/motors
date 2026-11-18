-- Identity, owner-only staff management and one-time owner bootstrap.
-- Repository migration only; do not apply until the remote migration ledger is safely reconciled.
begin;

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists middle_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

create unique index if not exists profiles_phone_unique_idx
  on public.profiles(phone) where phone is not null;

-- Email-addressed customers can sign in with their verified email or private phone number.
-- This index is readable only by the server-side service role, never by browser clients.
create table if not exists public.phone_login_index (
  phone text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  login_email text not null,
  created_at timestamptz not null default now()
);
alter table public.phone_login_index enable row level security;
revoke all on public.phone_login_index from public, anon, authenticated;
grant select, insert, update, delete on public.phone_login_index to service_role;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key = 'owner'
  );
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated, service_role;

-- Inspect the target account's actual roles without letting callers' user_roles RLS
-- hide staff assignments and accidentally make staff profiles look like customers.
create or replace function public.is_customer_profile(target_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id and r.key = 'customer'
  ) and not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id and r.key <> 'customer'
  );
$$;
revoke all on function public.is_customer_profile(uuid) from public, anon;
grant execute on function public.is_customer_profile(uuid) to authenticated;

create or replace function public.can_manage_user_role(target_user_id uuid, target_role_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select public.is_owner()
    and target_user_id <> auth.uid()
    and exists (select 1 from public.roles r where r.id = target_role_id and r.key not in ('owner','customer'));
$$;
revoke all on function public.can_manage_user_role(uuid, uuid) from public, anon;
grant execute on function public.can_manage_user_role(uuid, uuid) to authenticated;

create or replace function public.can_manage_role_permission(target_role_id uuid, target_permission_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
set row_security = off
as $$
  select public.is_owner()
    and exists (select 1 from public.roles r where r.id = target_role_id and r.key not in ('owner','customer'))
    and exists (select 1 from public.permissions p where p.id = target_permission_id);
$$;
revoke all on function public.can_manage_role_permission(uuid, uuid) from public, anon;
grant execute on function public.can_manage_role_permission(uuid, uuid) to authenticated;

-- Account creation always grants Customer only; role-like user metadata is ignored.
create or replace function public.bootstrap_new_user()
returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  customer_role_id uuid;
  first_name_value text;
  middle_name_value text;
  last_name_value text;
  phone_value text;
  accepted_at_value timestamptz;
  terms_version_value text;
  account_type_value text;
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

  if length(first_name_value) > 80 or length(middle_name_value) > 80 or length(last_name_value) > 80 then
    raise exception 'Invalid profile name.' using errcode = '22023';
  end if;
  if phone_value is not null and (length(phone_value) > 40 or phone_value !~ '^\+[1-9][0-9]{7,14}$') then
    raise exception 'Invalid profile phone.' using errcode = '22023';
  end if;
  if accepted_at_value is not null and terms_version_value is null then
    raise exception 'Terms version is required for accepted consent.' using errcode = '22023';
  end if;
  if account_type_value = 'customer' and (
    first_name_value = '' or middle_name_value = '' or last_name_value = ''
    or phone_value is null or new.email is null or accepted_at_value is null or terms_version_value is null
  ) then
    raise exception 'Customer registration requires full identity and policy acceptance.' using errcode = '22023';
  end if;
  if account_type_value in ('staff_invite','initial_owner') and (
    first_name_value = '' or middle_name_value = '' or last_name_value = '' or phone_value is null
  ) then
    raise exception 'Staff and Owner accounts require full name and phone.' using errcode = '22023';
  end if;
  if account_type_value = 'initial_owner' and (accepted_at_value is null or terms_version_value is null) then
    raise exception 'Owner provisioning requires policy acceptance.' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, first_name, middle_name, last_name, phone, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), concat_ws(' ', nullif(first_name_value, ''), nullif(middle_name_value, ''), nullif(last_name_value, ''))),
    first_name_value, middle_name_value, last_name_value, phone_value, accepted_at_value, terms_version_value
  ) on conflict (id) do update set
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    middle_name = excluded.middle_name,
    last_name = excluded.last_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version);

  if account_type_value = 'customer' then
    select id into customer_role_id from public.roles where key = 'customer';
    if customer_role_id is not null then
      insert into public.user_roles(user_id, role_id) values (new.id, customer_role_id)
      on conflict do nothing;
    end if;
  end if;
  if phone_value is not null and new.email is not null then
    insert into public.phone_login_index(phone, user_id, login_email)
    values (phone_value, new.id, new.email)
    on conflict (phone) do update set user_id = excluded.user_id, login_email = excluded.login_email;
  end if;
  return new;
end;
$$;
revoke all on function public.bootstrap_new_user() from public, anon, authenticated;

-- Existing users can edit names, but not rewrite phone ownership or recorded consent.
revoke update on public.profiles from authenticated;
grant update (display_name, first_name, middle_name, last_name) on public.profiles to authenticated;

drop policy if exists "profiles_read_self_or_staff" on public.profiles;
create policy "profiles_read_self_or_staff" on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_owner()
  or (
    public.has_permission('view_customers') and public.is_customer_profile(profiles.id)
  )
);

drop policy if exists "profiles_update_self_or_staff" on public.profiles;
create policy "profiles_update_self_customer_or_owner" on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  or public.is_owner()
  or (
    public.has_permission('edit_customers') and public.is_customer_profile(profiles.id)
  )
)
with check (
  id = (select auth.uid())
  or public.is_owner()
  or (
    public.has_permission('edit_customers') and public.is_customer_profile(profiles.id)
  )
);

drop policy if exists "user_roles_read_self_or_admin" on public.user_roles;
create policy "user_roles_read_self_or_owner" on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.is_owner());

drop policy if exists "audit_logs_read_authorized" on public.audit_logs;
create policy "audit_logs_read_owner_or_reports" on public.audit_logs for select to authenticated
using (
  public.is_owner()
  or (public.has_permission('view_reports') and entity not in ('user_roles','role_permissions'))
);

-- Only the Owner may change account-role assignments. The Owner role itself is never
-- delegated through this interface; initial bootstrap uses the service-only function below.
drop policy if exists "user_roles_manage_by_permission" on public.user_roles;
create policy "user_roles_insert_by_owner" on public.user_roles for insert to authenticated
with check (public.can_manage_user_role(user_id, role_id) and (assigned_by = (select auth.uid()) or assigned_by is null));
create policy "user_roles_delete_by_owner" on public.user_roles for delete to authenticated
using (user_id <> (select auth.uid()) and public.is_owner() and exists (
  select 1 from public.roles r where r.id = user_roles.role_id and r.key <> 'owner'
));

-- Role/permission catalogs remain readable, but edits are Owner-only.
drop policy if exists "roles_manage_by_permission" on public.roles;
create policy "roles_manage_by_owner" on public.roles for all to authenticated
using (public.is_owner() and not is_system) with check (public.is_owner() and not is_system);
drop policy if exists "permissions_manage_by_permission" on public.permissions;
create policy "permissions_manage_by_owner" on public.permissions for all to authenticated
using (public.is_owner()) with check (public.is_owner());
drop policy if exists "role_permissions_manage_by_permission" on public.role_permissions;
create policy "role_permissions_manage_by_owner" on public.role_permissions for all to authenticated
using (public.can_manage_role_permission(role_id, permission_id))
with check (public.can_manage_role_permission(role_id, permission_id));

create or replace function public.audit_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
  affected_role_id uuid;
  role_key text;
  actor uuid;
begin
  if tg_op = 'DELETE' then
    affected_user_id := old.user_id;
    affected_role_id := old.role_id;
    actor := auth.uid();
  else
    affected_user_id := new.user_id;
    affected_role_id := new.role_id;
    actor := coalesce(auth.uid(), new.assigned_by);
  end if;
  select r.key into role_key from public.roles r where r.id = affected_role_id;
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_id, action, entity, entity_id, new_data)
    values (actor, 'user_role.assigned', 'user_roles', affected_user_id::text || ':' || affected_role_id::text,
      jsonb_build_object('role_key', role_key));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs(actor_id, action, entity, entity_id, old_data)
    values (actor, 'user_role.removed', 'user_roles', affected_user_id::text || ':' || affected_role_id::text,
      jsonb_build_object('role_key', role_key));
    return old;
  else
    insert into public.audit_logs(actor_id, action, entity, entity_id, old_data, new_data)
    values (actor, 'user_role.updated', 'user_roles', affected_user_id::text || ':' || affected_role_id::text,
      jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id),
      jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id, 'role_key', role_key));
    return new;
  end if;
end;
$$;
revoke all on function public.audit_user_role_change() from public, anon, authenticated;
drop trigger if exists user_roles_audit_changes on public.user_roles;
create trigger user_roles_audit_changes
after insert or update or delete on public.user_roles
for each row execute function public.audit_user_role_change();

create or replace function public.audit_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  pid uuid;
  rkey text;
  pkey text;
begin
  if tg_op = 'DELETE' then rid := old.role_id; pid := old.permission_id; else rid := new.role_id; pid := new.permission_id; end if;
  select key into rkey from public.roles where id = rid;
  select key into pkey from public.permissions where id = pid;
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_id, action, entity, entity_id, new_data)
    values (auth.uid(), 'role_permission.granted', 'role_permissions', rid::text || ':' || pid::text, jsonb_build_object('role_key', rkey, 'permission_key', pkey));
    return new;
  else
    insert into public.audit_logs(actor_id, action, entity, entity_id, old_data)
    values (auth.uid(), 'role_permission.revoked', 'role_permissions', rid::text || ':' || pid::text, jsonb_build_object('role_key', rkey, 'permission_key', pkey));
    return old;
  end if;
end;
$$;
revoke all on function public.audit_role_permission_change() from public, anon, authenticated;
create trigger role_permissions_audit_changes
after insert or delete on public.role_permissions
for each row execute function public.audit_role_permission_change();

-- Customer request surfaces and writes are reserved for customer-only accounts.
drop policy if exists "purchase_requests_read_own_or_managed" on public.purchase_requests;
create policy "purchase_requests_read_customer_or_managed" on public.purchase_requests
for select to authenticated
using (
  (customer_id = (select auth.uid()) and public.is_customer_profile((select auth.uid())))
  or public.has_permission('manage_requests')
);
drop policy if exists "purchase_requests_create_own_pending" on public.purchase_requests;
create policy "purchase_requests_create_customer_pending" on public.purchase_requests
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and public.is_customer_profile((select auth.uid()))
  and status = 'pending'
  and (motorcycle_id is null or exists (
    select 1 from public.public_motorcycle_catalog catalog
    where catalog.id = purchase_requests.motorcycle_id
  ))
);
drop policy if exists "import_requests_read_own_or_managed" on public.import_requests;
create policy "import_requests_read_customer_or_managed" on public.import_requests
for select to authenticated
using (
  (customer_id = (select auth.uid()) and public.is_customer_profile((select auth.uid())))
  or public.has_permission('manage_requests')
);
drop policy if exists "import_requests_create_own_pending" on public.import_requests;
create policy "import_requests_create_customer_pending" on public.import_requests
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and public.is_customer_profile((select auth.uid()))
  and status = 'pending'
);

-- One-time server-only Owner provisioning. It accepts no password or credential; the
-- trusted server creates the auth user separately, then promotes it via this transaction.
create or replace function public.bootstrap_initial_owner(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  owner_role_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;
  -- Serialize concurrent setup attempts so exactly one can claim the initial Owner role.
  perform pg_advisory_xact_lock(hashtext('el-khayal-motors-initial-owner'));
  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where r.key = 'owner'
  ) then
    raise exception 'Initial Owner is already provisioned.' using errcode = '23505';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'Owner profile does not exist.' using errcode = '23503';
  end if;
  select id into owner_role_id from public.roles where key = 'owner';
  if owner_role_id is null then raise exception 'Owner role is missing.' using errcode = '23503'; end if;

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles(user_id, role_id, assigned_by) values (target_user_id, owner_role_id, null);
  insert into public.audit_logs(actor_id, action, entity, entity_id, new_data)
  values (null, 'owner.initial_provisioned', 'user_roles', target_user_id::text, jsonb_build_object('role_key', 'owner'));
end;
$$;
revoke all on function public.bootstrap_initial_owner(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_initial_owner(uuid) to service_role;

commit;
