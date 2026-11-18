'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { egyptianPhoneSchema, personNamePart, policyVersion } from '@/lib/auth/identity';

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === 'string' ? field : '';
}

function secretMatches(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function provisionInitialOwnerAction(formData: FormData) {
  const expectedToken = process.env.OWNER_BOOTSTRAP_TOKEN ?? '';
  const rawPhone = process.env.OWNER_BOOTSTRAP_PHONE ?? '';
  const acceptedTerms = value(formData, 'acceptedTerms') === 'yes';
  const parsed = z.object({
    token: z.string().min(32).max(512),
    firstName: personNamePart,
    middleName: personNamePart,
    lastName: personNamePart,
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  }).refine((input) => input.password === input.confirmPassword).safeParse({
    token: value(formData, 'token'),
    firstName: value(formData, 'firstName'),
    middleName: value(formData, 'middleName'),
    lastName: value(formData, 'lastName'),
    password: value(formData, 'password'),
    confirmPassword: value(formData, 'confirmPassword'),
  });
  const phone = egyptianPhoneSchema.safeParse(rawPhone);
  if (!expectedToken || !rawPhone || !parsed.success || !phone.success || !acceptedTerms || !secretMatches(parsed.data.token, expectedToken)) {
    redirect('/setup/owner?error=unavailable');
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect('/setup/owner?error=unavailable');
  }
  const { data: ownerRole, error: rolesError } = await admin.from('roles').select('id').eq('key', 'owner').maybeSingle();
  if (rolesError || !ownerRole) redirect('/setup/owner?error=unavailable');
  const { data: assignments, error: assignmentsError } = await admin.from('user_roles').select('user_id').eq('role_id', ownerRole.id).limit(1);
  if (assignmentsError) redirect('/setup/owner?error=unavailable');
  if (assignments?.length) redirect('/setup/owner?error=used');

  const fullName = `${parsed.data.firstName} ${parsed.data.middleName} ${parsed.data.lastName}`;
  const { data, error } = await admin.auth.admin.createUser({
    phone: phone.data,
    password: parsed.data.password,
    phone_confirm: true,
    user_metadata: {
      account_type: 'initial_owner',
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName,
      last_name: parsed.data.lastName,
      full_name: fullName,
      phone: phone.data,
      terms_accepted: true,
      terms_version: policyVersion,
    },
  });
  if (error || !data.user) redirect('/setup/owner?error=create');
  const { error: bootstrapError } = await admin.rpc('bootstrap_initial_owner', { target_user_id: data.user.id });
  if (bootstrapError) {
    // Resolve an uncertain RPC before any cleanup; never delete an account that became Owner.
    const { data: currentOwnerRole } = await admin.from('roles').select('id').eq('key', 'owner').maybeSingle();
    if (!currentOwnerRole) redirect('/setup/owner?error=check');
    const { data: currentAssignment, error: stateError } = await admin.from('user_roles')
      .select('user_id').eq('user_id', data.user.id).eq('role_id', currentOwnerRole.id).maybeSingle();
    if (stateError) redirect('/setup/owner?error=check');
    if (currentAssignment) redirect('/setup/owner?done=1');
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) redirect('/setup/owner?error=cleanup');
    redirect('/setup/owner?error=provision');
  }
  redirect('/setup/owner?done=1');
}
