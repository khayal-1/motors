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
