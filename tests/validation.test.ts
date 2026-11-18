import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261118180000_foundation.sql'), 'utf8');
const gitignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8');
const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');

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
    expect(envExample).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
