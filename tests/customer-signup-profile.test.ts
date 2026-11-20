import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveCustomerSignupProfile } from '../lib/auth/customer-signup-profile';

const profile = {
  email: 'customer@example.com',
  firstName: 'Ali',
  middleName: 'Hassan',
  lastName: 'Ali',
  phone: '+201100000000',
  termsVersion: '2026-01',
};

type ClientWriteResult = { data: { user_id: string } | null; error: { message: string } | null };
type PhoneWriteResult = { error: { message: string } | null };

function makeAdmin(
  clientResult: ClientWriteResult = { data: { user_id: 'user-1' }, error: null },
  phoneResult: PhoneWriteResult = { error: null },
) {
  const clientUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(clientResult) }),
  });
  const phoneUpsert = vi.fn().mockResolvedValue(phoneResult);
  const from = vi.fn((table: string) => ({ upsert: table === 'clients' ? clientUpsert : phoneUpsert }));
  return { admin: { from } as unknown as SupabaseClient, clientUpsert, phoneUpsert };
}

describe('saveCustomerSignupProfile', () => {
  it('creates or updates the client row by Auth user id before indexing its phone', async () => {
    const { admin, clientUpsert, phoneUpsert } = makeAdmin();

    await expect(saveCustomerSignupProfile(admin, 'user-1', profile, '2026-11-20T00:00:00.000Z')).resolves.toBe(true);
    expect(clientUpsert).toHaveBeenCalledWith({
      user_id: 'user-1', name: 'Ali Hassan Ali', first_name: 'Ali', middle_name: 'Hassan',
      last_name: 'Ali', phone: '+201100000000', terms_accepted_at: '2026-11-20T00:00:00.000Z',
      terms_version: '2026-01',
    }, { onConflict: 'user_id' });
    expect(phoneUpsert).toHaveBeenCalledWith({
      phone: '+201100000000', user_id: 'user-1', login_email: 'customer@example.com',
    }, { onConflict: 'user_id' });
  });

  it('does not report success or index a phone when the client row cannot be saved', async () => {
    const { admin, phoneUpsert } = makeAdmin({ data: null, error: { message: 'write failed' } });
    await expect(saveCustomerSignupProfile(admin, 'user-1', profile, '2026-11-20T00:00:00.000Z')).resolves.toBe(false);
    expect(phoneUpsert).not.toHaveBeenCalled();
  });

  it('reports phone-index failures and catches thrown write errors', async () => {
    const phoneFailure = makeAdmin(undefined, { error: { message: 'phone conflict' } });
    await expect(saveCustomerSignupProfile(phoneFailure.admin, 'user-1', profile, '2026-11-20T00:00:00.000Z')).resolves.toBe(false);

    const thrown = makeAdmin();
    thrown.clientUpsert.mockImplementation(() => { throw new Error('network'); });
    await expect(saveCustomerSignupProfile(thrown.admin, 'user-1', profile, '2026-11-20T00:00:00.000Z')).resolves.toBe(false);
  });
});
