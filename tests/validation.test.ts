import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261118180000_foundation.sql'), 'utf8');
const teamMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261118193000_staff_role_management.sql'), 'utf8');
const gitignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8');
const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

describe('Owner-only team and identity security contract', () => {
  it('does not promote public registrations beyond Customer and records explicit policy acceptance', () => {
    expect(teamMigration).toContain("r.key = 'customer'");
    expect(teamMigration).toContain("new.raw_user_meta_data ->> 'terms_accepted' = 'true'");
    expect(teamMigration).toContain('terms_accepted_at');
    expect(teamMigration).toContain('Customer registration requires full identity and policy acceptance.');
    expect(teamMigration).toContain("if account_type_value = 'customer' then");
    expect(teamMigration).toContain("if account_type_value in ('staff_invite','initial_owner')");
    expect(teamMigration).toContain('phone_login_index');
  });

  it('reserves staff and role-permission writes to the Owner and hides staff profiles under RLS', () => {
    expect(teamMigration).toContain('create policy "user_roles_insert_by_owner"');
    expect(teamMigration).toContain('public.can_manage_user_role(user_id, role_id)');
    expect(teamMigration).toContain('create policy "role_permissions_manage_by_owner"');
    expect(teamMigration).toContain('public.is_customer_profile(profiles.id)');
    expect(teamMigration).toContain('purchase_requests_create_customer_pending');
    expect(teamMigration).toContain('import_requests_create_customer_pending');
    expect(teamMigration).toContain('public.is_customer_profile((select auth.uid()))');
    expect(teamMigration).toContain("r.key not in ('owner','customer')");
  });

  it('makes initial Owner setup service-only and serialized', () => {
    expect(teamMigration).toContain("if auth.role() <> 'service_role'");
    expect(teamMigration).toContain('pg_advisory_xact_lock');
    expect(teamMigration).toContain('grant execute on function public.bootstrap_initial_owner(uuid) to service_role');
  });
});

describe('Phase 1 foundation safety contract', () => {
  it('uses relational extensible role and permission tables, not fixed app roles', () => {
    for (const table of ['roles', 'permissions', 'role_permissions', 'user_roles']) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("'manage_permissions'");
  });

  it('enables RLS for every sensitive foundation table', () => {
    for (const table of ['profiles', 'roles', 'permissions', 'role_permissions', 'user_roles', 'motorcycles', 'motorcycle_media', 'audit_logs']) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
  });

  it('does not expose purchase cost or serial identifiers in public catalog view', () => {
    const view = migration.split('create view public.public_motorcycle_catalog')[1]?.split('grant select on public.public_motorcycle_catalog')[0] ?? '';
    expect(view).toContain('public.motorcycles');
    expect(view).not.toContain('purchase_cost');
    expect(view).not.toContain('engine_number');
    expect(view).not.toContain('chassis_number');
  });

  it('prevents normalized chassis and engine duplicates and avoids client audit writes', () => {
    expect(migration).toContain('motorcycles_chassis_normalized_uidx');
    expect(migration).toContain('motorcycles_engine_normalized_uidx');
    expect(migration).toContain('No client INSERT/UPDATE/DELETE policies on audit_logs');
    expect(migration).not.toContain('for delete to authenticated');
    expect(migration).toContain('revoke all on public.profiles');
    expect(migration).toContain('grant select on public.public_motorcycle_catalog to anon, authenticated');
    const policyNames = [...migration.matchAll(/create policy \"([^\"]+)\"/g)].map((match) => match[1]);
    expect(new Set(policyNames).size).toBe(policyNames.length);
  });

  it('ignores local environment files and keeps the example free of supplied credentials', () => {
    expect(gitignore).toContain('.env.*');
    expect(gitignore).toContain('!.env.example');
    expect(envExample).not.toContain('lbfumcrrfljmnucestvk');
    expect(envExample).not.toContain('sb_publishable_');
    expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY=\n');
    expect(envExample).toContain('OWNER_BOOTSTRAP_TOKEN=\n');
    expect(envExample).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|TOKEN)=/);
  });
});

import { sanitizeCatalogSearch, formatPrice, formatMotorcycleStatus } from '../lib/catalog';

describe('public catalog helpers', () => {
  it('keeps Arabic search terms and strips PostgREST filter syntax', () => {
    expect(sanitizeCatalogSearch('هوندا 125')).toBe('هوندا 125');
    expect(sanitizeCatalogSearch('Honda,model.ilike.*')).toBe('Honda model ilike');
    expect(sanitizeCatalogSearch('   ')).toBe('');
  });

  it('formats only public listing fields without exposing internal data', () => {
    expect(formatPrice(125000)).toContain('١٢٥٬٠٠٠');
    expect(formatMotorcycleStatus('Coming Soon')).toBe('قريبًا');
    expect(formatMotorcycleStatus('Available')).toBe('متاحة');
  });
});
