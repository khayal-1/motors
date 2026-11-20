-- Consolidated record of the changes applied LIVE to the Supabase project on 2026-11-21.
-- The database already contains these changes. On the live project, mark this migration as
-- applied WITHOUT running it:   supabase migration repair --status applied 20261121120000
-- On any fresh database, run it after 20261119100000_clients_auth_separation.sql.
-- It is idempotent, so re-running it is safe.
--
-- NOTE: the owner account is NOT created here (it needs a password). Create it with the
-- one-time /setup/owner flow, or directly in the Supabase dashboard.

-- ---------------------------------------------------------------------------
-- 1) Function execution: no anonymous access (authenticated stays: RLS policies call these)
-- ---------------------------------------------------------------------------
revoke execute on function public.has_permission(text) from public, anon;
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_customer_profile(uuid) from public, anon;
revoke execute on function public.can_manage_role_permission(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_user_role(uuid, uuid) from public, anon;
revoke execute on function public.update_my_client_profile(text, text, text, text, text, text) from public, anon;

grant execute on function public.has_permission(text) to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;
grant execute on function public.is_customer_profile(uuid) to authenticated, service_role;
grant execute on function public.can_manage_role_permission(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_user_role(uuid, uuid) to authenticated, service_role;
grant execute on function public.update_my_client_profile(text, text, text, text, text, text) to authenticated, service_role;

-- event-trigger helper must never be callable through the API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Table privileges: TRUNCATE/TRIGGER/REFERENCES are not covered by RLS
-- ---------------------------------------------------------------------------
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Missing foreign-key indexes
-- ---------------------------------------------------------------------------
create index if not exists motorcycles_created_by_idx on public.motorcycles (created_by);
create index if not exists motorcycles_updated_by_idx on public.motorcycles (updated_by);
create index if not exists user_roles_assigned_by_idx on public.user_roles (assigned_by);

-- ---------------------------------------------------------------------------
-- 4) Public catalog: views owned by the table owner expose ONLY safe columns/rows
--    (never purchase_cost, engine_number, chassis_number). Read-only.
-- ---------------------------------------------------------------------------
alter view public.public_motorcycle_catalog set (security_invoker = false);
revoke all on public.public_motorcycle_catalog from anon, authenticated;
grant select on public.public_motorcycle_catalog to anon, authenticated;

create or replace view public.public_motorcycle_media with (security_barrier = true) as
select m.id, m.motorcycle_id, m.media_type, m.provider, m.provider_file_id,
       m.file_name, m.mime_type, m.sort_order
from public.motorcycle_media m
join public.motorcycles c on c.id = m.motorcycle_id
where c.status in ('Available', 'Coming Soon')
  and m.media_type in ('image', 'video');
revoke all on public.public_motorcycle_media from anon, authenticated;
grant select on public.public_motorcycle_media to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Split FOR ALL policies (removes duplicate permissive SELECT policies)
-- ---------------------------------------------------------------------------
drop policy if exists permissions_manage_by_owner on public.permissions;
drop policy if exists permissions_insert_owner on public.permissions;
drop policy if exists permissions_update_owner on public.permissions;
drop policy if exists permissions_delete_owner on public.permissions;
create policy permissions_insert_owner on public.permissions for insert to authenticated
  with check (public.is_owner());
create policy permissions_update_owner on public.permissions for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy permissions_delete_owner on public.permissions for delete to authenticated
  using (public.is_owner());

drop policy if exists roles_manage_by_owner on public.roles;
drop policy if exists roles_insert_owner on public.roles;
drop policy if exists roles_update_owner on public.roles;
drop policy if exists roles_delete_owner on public.roles;
create policy roles_insert_owner on public.roles for insert to authenticated
  with check (public.is_owner() and not is_system);
create policy roles_update_owner on public.roles for update to authenticated
  using (public.is_owner() and not is_system) with check (public.is_owner() and not is_system);
create policy roles_delete_owner on public.roles for delete to authenticated
  using (public.is_owner() and not is_system);

drop policy if exists role_permissions_manage_by_owner on public.role_permissions;
drop policy if exists role_permissions_insert_manager on public.role_permissions;
drop policy if exists role_permissions_update_manager on public.role_permissions;
drop policy if exists role_permissions_delete_manager on public.role_permissions;
create policy role_permissions_insert_manager on public.role_permissions for insert to authenticated
  with check (public.can_manage_role_permission(role_id, permission_id));
create policy role_permissions_update_manager on public.role_permissions for update to authenticated
  using (public.can_manage_role_permission(role_id, permission_id))
  with check (public.can_manage_role_permission(role_id, permission_id));
create policy role_permissions_delete_manager on public.role_permissions for delete to authenticated
  using (public.can_manage_role_permission(role_id, permission_id));

-- ---------------------------------------------------------------------------
-- 6) Signup trigger.
--    * customers: created with an empty profile/client; the app validates the three-part name
--      and phone and saves them server-side right after signup.
--    * staff / owner (account_type from app_metadata or the invite metadata): need a name and a
--      valid phone only. Phone is stored, never verified. Email is the only confirmation channel.
--    * Egyptian local numbers 01XXXXXXXXX are normalised to +20XXXXXXXXXX.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  customer_role_id uuid;
  account_type_value text;
  first_v text; middle_v text; last_v text; phone_v text; display_v text;
  accepted_at_v timestamptz; terms_v text;
begin
  account_type_value := coalesce(
    nullif(trim(new.raw_app_meta_data ->> 'account_type'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'account_type'), ''),
    'customer');
  if account_type_value = 'staff' then account_type_value := 'staff_invite'; end if;
  if account_type_value not in ('customer', 'staff_invite', 'initial_owner') then
    raise exception 'Unsupported account type.' using errcode = '22023';
  end if;

  first_v  := coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), '');
  middle_v := coalesce(nullif(trim(new.raw_user_meta_data ->> 'middle_name'), ''), '');
  last_v   := coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), '');

  phone_v := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), '[[:space:]-]', '', 'g'), '');
  if phone_v ~ '^01[0-9]{9}$' then phone_v := '+20' || substr(phone_v, 2); end if;

  accepted_at_v := case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() else null end;
  terms_v := case when accepted_at_v is not null then nullif(trim(new.raw_user_meta_data ->> 'terms_version'), '') else null end;

  display_v := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    concat_ws(' ', nullif(first_v, ''), nullif(middle_v, ''), nullif(last_v, ''))
  );

  if account_type_value in ('staff_invite', 'initial_owner') then
    if first_v = '' or phone_v is null or phone_v !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception 'Staff and Owner accounts require a name and a valid phone.' using errcode = '22023';
    end if;
    if length(first_v) > 80 or length(middle_v) > 80 or length(last_v) > 80 or length(phone_v) > 40 then
      raise exception 'Invalid staff identity.' using errcode = '22023';
    end if;
    if accepted_at_v is not null and terms_v is null then
      raise exception 'Terms version is required for accepted consent.' using errcode = '22023';
    end if;
    if account_type_value = 'initial_owner' and (accepted_at_v is null or terms_v is null) then
      raise exception 'Owner provisioning requires policy acceptance.' using errcode = '22023';
    end if;

    insert into public.profiles (id, display_name, first_name, middle_name, last_name, phone, terms_accepted_at, terms_version)
    values (new.id, coalesce(display_v, ''), first_v, middle_v, last_v, phone_v, accepted_at_v, terms_v)
    on conflict (id) do update set
      display_name = excluded.display_name, first_name = excluded.first_name,
      middle_name = excluded.middle_name, last_name = excluded.last_name,
      phone = coalesce(excluded.phone, public.profiles.phone),
      terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
      terms_version = coalesce(excluded.terms_version, public.profiles.terms_version);

    if new.email is not null then
      insert into public.phone_login_index (phone, user_id, login_email)
      values (phone_v, new.id, new.email)
      on conflict (phone) do update set login_email = excluded.login_email
      where public.phone_login_index.user_id = excluded.user_id;
      if not found then raise exception 'Phone number is already in use.' using errcode = '23505'; end if;
    end if;
  else
    insert into public.profiles (id, display_name) values (new.id, '') on conflict (id) do nothing;
    insert into public.clients (user_id) values (new.id) on conflict (user_id) do nothing;
    select id into customer_role_id from public.roles where key = 'customer';
    if customer_role_id is not null then
      insert into public.user_roles (user_id, role_id) values (new.id, customer_role_id) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$function$;
