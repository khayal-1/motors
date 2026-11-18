'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { supabaseEnv } from '@/lib/supabase/env';
import { safeNextPath } from '@/lib/auth/redirect';
import { customerSignupSchema, emailSchema, egyptianPhoneSchema, loginCredentials, passwordSchema, policyVersion } from '@/lib/auth/identity';

const loginIdentifierSchema = z.string().trim().min(1).max(254);
function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === 'string' ? item : '';
}

function callbackUrl(next: string) {
  const url = new URL('/auth/callback', supabaseEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set('next', next);
  return url.toString();
}

export async function signInAction(formData: FormData) {
  const next = safeNextPath(value(formData, 'next'), '/account');
  const identifier = loginIdentifierSchema.safeParse(value(formData, 'identifier'));
  const password = passwordSchema.safeParse(value(formData, 'password'));
  if (!identifier.success || !password.success) redirect(`/auth/login?error=invalid&next=${encodeURIComponent(next)}`);
  const credentials = loginCredentials(identifier.data, password.data);
  if (!credentials) redirect(`/auth/login?error=invalid&next=${encodeURIComponent(next)}`);
  let signInCredentials = credentials;
  if ('phone' in credentials) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.from('phone_login_index').select('login_email').eq('phone', credentials.phone).maybeSingle();
      if (data?.login_email) signInCredentials = { email: data.login_email, password: credentials.password };
    } catch {
      // Phone-native Supabase accounts can still authenticate directly without the private lookup index.
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(signInCredentials);
  if (error) redirect(`/auth/login?error=credentials&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const next = safeNextPath(value(formData, 'next'), '/account');
  const parsed = customerSignupSchema.safeParse({
    firstName: value(formData, 'firstName'),
    middleName: value(formData, 'middleName'),
    lastName: value(formData, 'lastName'),
    phone: value(formData, 'phone'),
    email: value(formData, 'email'),
    password: value(formData, 'password'),
    confirmPassword: value(formData, 'confirmPassword'),
    acceptedTerms: value(formData, 'acceptedTerms') === 'yes',
  });
  if (!parsed.success) redirect(`/auth/signup?error=invalid&next=${encodeURIComponent(next)}`);
  const reservedOwnerPhone = egyptianPhoneSchema.safeParse(process.env.OWNER_BOOTSTRAP_PHONE ?? '');
  if (reservedOwnerPhone.success && reservedOwnerPhone.data === parsed.data.phone) {
    redirect(`/auth/signup?error=reserved&next=${encodeURIComponent(next)}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        account_type: 'customer',
        first_name: parsed.data.firstName,
        middle_name: parsed.data.middleName,
        last_name: parsed.data.lastName,
        full_name: `${parsed.data.firstName} ${parsed.data.middleName} ${parsed.data.lastName}`,
        phone: parsed.data.phone,
        terms_accepted: true,
        terms_version: policyVersion,
      },
      emailRedirectTo: callbackUrl(next),
    },
  });
  if (error) redirect(`/auth/signup?error=signup&next=${encodeURIComponent(next)}`);
  if (data.session) redirect(next);
  redirect(`/auth/signup?sent=1&next=${encodeURIComponent(next)}`);
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = emailSchema.safeParse(value(formData, 'email'));
  if (!parsed.success) redirect('/auth/forgot-password?error=invalid');
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: callbackUrl('/auth/reset-password'),
  });
  if (error) redirect('/auth/forgot-password?error=request');
  redirect('/auth/forgot-password?sent=1');
}

export async function updatePasswordAction(formData: FormData) {
  const password = passwordSchema.safeParse(value(formData, 'password'));
  if (!password.success) redirect('/auth/reset-password?error=invalid');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect('/auth/reset-password?error=update');
  redirect('/account');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
