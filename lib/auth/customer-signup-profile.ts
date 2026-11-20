import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerSignupProfile {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  termsVersion: string;
}

/** Save the customer row even when an older Auth trigger did not seed it. */
export async function saveCustomerSignupProfile(
  admin: SupabaseClient,
  userId: string,
  profile: CustomerSignupProfile,
  acceptedAt: string,
): Promise<boolean> {
  try {
    const { data: client, error: clientError } = await admin.from('clients').upsert({
      user_id: userId,
      name: `${profile.firstName} ${profile.middleName} ${profile.lastName}`,
      first_name: profile.firstName,
      middle_name: profile.middleName,
      last_name: profile.lastName,
      phone: profile.phone,
      terms_accepted_at: acceptedAt,
      terms_version: profile.termsVersion,
    }, { onConflict: 'user_id' }).select('user_id').maybeSingle();

    if (clientError || client?.user_id !== userId) return false;

    const { error: phoneIndexError } = await admin.from('phone_login_index').upsert({
      phone: profile.phone,
      user_id: userId,
      login_email: profile.email,
    }, { onConflict: 'user_id' });
    return !phoneIndexError;
  } catch {
    return false;
  }
}
