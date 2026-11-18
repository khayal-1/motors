'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseEnv } from '@/lib/supabase/env';
import { safeNextPath } from '@/lib/auth/redirect';

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const authSchema = z.object({ email: emailSchema, password: passwordSchema });
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
  const next = safeNextPath(value(formData, 'next'));
  const parsed = authSchema.safeParse({ email: value(formData, 'email'), password: value(formData, 'password') });
  if (!parsed.success) redirect(`/auth/login?error=invalid&next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/auth/login?error=credentials&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const next = safeNextPath(value(formData, 'next'));
  const parsed = authSchema.extend({ name: z.string().trim().min(2).max(120) }).safeParse({ email: value(formData, 'email'), password: value(formData, 'password'), name: value(formData, 'name') });
  if (!parsed.success) redirect(`/auth/signup?error=invalid&next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name }, emailRedirectTo: callbackUrl(next) },
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
  redirect('/admin');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
