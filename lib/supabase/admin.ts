import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/supabase/env';

/** Privileged Supabase access stays server-only and is used after an explicit owner check. */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Server-side Supabase administration is not configured.');
  return createClient(supabaseEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
