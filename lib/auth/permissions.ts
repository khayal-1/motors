import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function userHasPermission(permission: string): Promise<boolean> {
  const { supabase, user } = await requireUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('has_permission', { permission_key: permission });
  return !error && data === true;
}

export async function userIsOwner(): Promise<boolean> {
  const { supabase, user } = await requireUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc('is_owner');
  return !error && data === true;
}

export async function requireCustomer(nextPath = '/account') {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  const { data, error } = await supabase.rpc('is_customer_profile', { target_user_id: user.id });
  if (error || data !== true) redirect('/admin?error=forbidden');
  return { supabase, user };
}
