'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, userHasPermission, userIsOwner } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { egyptianPhoneSchema } from '@/lib/auth/identity';
import { canAssignRole, roleAssignmentSchema, rolePermissionSchema, staffInviteSchema } from '@/lib/team/validation';
import { supabaseEnv } from '@/lib/supabase/env';

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === 'string' ? field : '';
}

async function requireOwner() {
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fteam');
  if (!(await userHasPermission('manage_users')) || !(await userIsOwner())) redirect('/admin?error=forbidden');
  return { supabase, user };
}

async function rolePermissions(supabase: Awaited<ReturnType<typeof requireUser>>['supabase'], roleId: string) {
  const { data: rows, error } = await supabase.from('role_permissions').select('permission_id').eq('role_id', roleId);
  if (error) return null;
  const ids = (rows ?? []).map((row) => row.permission_id);
  if (!ids.length) return [];
  const { data: permissions, error: permissionsError } = await supabase.from('permissions').select('key').in('id', ids);
  if (permissionsError) return null;
  return (permissions ?? []).map((permission) => permission.key);
}

export async function assignStaffRoleAction(formData: FormData) {
  const parsed = roleAssignmentSchema.safeParse({ userId: value(formData, 'userId'), roleId: value(formData, 'roleId') });
  if (!parsed.success) redirect('/admin/team?error=invalid');
  const { supabase, user } = await requireOwner();
  const { data: role, error: roleError } = await supabase.from('roles').select('id,key').eq('id', parsed.data.roleId).maybeSingle();
  if (roleError || !role) redirect('/admin/team?error=save');
  const permissionKeys = await rolePermissions(supabase, role.id);
  if (!permissionKeys || !canAssignRole(role.key, permissionKeys, true)) redirect('/admin/team?error=protected');
  const { error } = await supabase.from('user_roles').insert({ user_id: parsed.data.userId, role_id: role.id, assigned_by: user.id });
  if (error) redirect(`/admin/team?error=${error.code === '23505' ? 'duplicate' : error.code === '42501' ? 'protected' : 'save'}`);
  const { data: customerRole, error: customerLookupError } = await supabase.from('roles').select('id').eq('key', 'customer').maybeSingle();
  if (customerLookupError || !customerRole) {
    await supabase.from('user_roles').delete().eq('user_id', parsed.data.userId).eq('role_id', role.id);
    redirect('/admin/team?error=save');
  }
  const { error: customerDeleteError } = await supabase.from('user_roles').delete().eq('user_id', parsed.data.userId).eq('role_id', customerRole.id);
  if (customerDeleteError) {
    await supabase.from('user_roles').delete().eq('user_id', parsed.data.userId).eq('role_id', role.id);
    redirect('/admin/team?error=save');
  }
  redirect('/admin/team?updated=assigned');
}

export async function removeStaffRoleAction(formData: FormData) {
  const parsed = roleAssignmentSchema.safeParse({ userId: value(formData, 'userId'), roleId: value(formData, 'roleId') });
  if (!parsed.success) redirect('/admin/team?error=invalid');
  const { supabase, user } = await requireOwner();
  if (parsed.data.userId === user.id) redirect('/admin/team?error=protected');
  const { data: role, error: roleError } = await supabase.from('roles').select('key').eq('id', parsed.data.roleId).maybeSingle();
  if (roleError || !role || role.key === 'owner') redirect('/admin/team?error=protected');
  const { data, error } = await supabase.from('user_roles').delete().eq('user_id', parsed.data.userId).eq('role_id', parsed.data.roleId).select('user_id').maybeSingle();
  if (error) redirect(`/admin/team?error=${error.code === '42501' ? 'protected' : 'save'}`);
  if (!data) redirect('/admin/team?error=notfound');
  redirect('/admin/team?updated=removed');
}

export async function inviteStaffAction(formData: FormData) {
  const parsed = staffInviteSchema.safeParse({
    firstName: value(formData, 'firstName'), middleName: value(formData, 'middleName'), lastName: value(formData, 'lastName'),
    phone: value(formData, 'phone'), email: value(formData, 'email'), roleId: value(formData, 'roleId'),
  });
  const phone = parsed.success ? egyptianPhoneSchema.safeParse(parsed.data.phone) : null;
  if (!parsed.success || !phone?.success) redirect('/admin/team?error=invalid');
  const { supabase, user } = await requireOwner();

  const { data: role, error: roleError } = await supabase.from('roles').select('id,key').eq('id', parsed.data.roleId).maybeSingle();
  if (roleError || !role) redirect('/admin/team?error=save');
  const permissionKeys = await rolePermissions(supabase, role.id);
  if (!permissionKeys || !canAssignRole(role.key, permissionKeys, true)) redirect('/admin/team?error=protected');

  let admin;
  try { admin = createAdminClient(); } catch { redirect('/admin/team?error=configuration'); }
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: new URL('/auth/callback?next=%2Fadmin', supabaseEnv.NEXT_PUBLIC_SITE_URL).toString(),
    data: {
      account_type: 'staff_invite', first_name: parsed.data.firstName, middle_name: parsed.data.middleName,
      last_name: parsed.data.lastName, full_name: `${parsed.data.firstName} ${parsed.data.middleName} ${parsed.data.lastName}`,
      phone: phone.data, invited_by: user.id,
    },
  });
  if (inviteError || !invite.user) redirect('/admin/team?error=invite');

  const { error: assignError } = await supabase.from('user_roles').insert({ user_id: invite.user.id, role_id: role.id, assigned_by: user.id });
  if (assignError) {
    await admin.auth.admin.updateUserById(invite.user.id, { ban_duration: '876000h' });
    redirect('/admin/team?error=invite');
  }
  const { data: customerRole, error: customerRoleLookupError } = await supabase.from('roles').select('id').eq('key', 'customer').maybeSingle();
  if (customerRoleLookupError || !customerRole) {
    await supabase.from('user_roles').delete().eq('user_id', invite.user.id).eq('role_id', role.id);
    await admin.auth.admin.updateUserById(invite.user.id, { ban_duration: '876000h' });
    redirect('/admin/team?error=invite');
  }
  const { error: customerRoleError } = await supabase.from('user_roles').delete().eq('user_id', invite.user.id).eq('role_id', customerRole.id);
  if (customerRoleError) {
    await supabase.from('user_roles').delete().eq('user_id', invite.user.id).eq('role_id', role.id);
    await admin.auth.admin.updateUserById(invite.user.id, { ban_duration: '876000h' });
    redirect('/admin/team?error=invite');
  }
  redirect('/admin/team?updated=invited');
}

export async function deactivateStaffAction(formData: FormData) {
  const parsed = zodUserId.safeParse(value(formData, 'userId'));
  if (!parsed.success) redirect('/admin/team?error=invalid');
  const { supabase, user } = await requireOwner();
  if (parsed.data === user.id) redirect('/admin/team?error=protected');
  const { data: assignments, error } = await supabase.from('user_roles').select('role_id').eq('user_id', parsed.data);
  if (error || !assignments?.length) redirect('/admin/team?error=notfound');
  const { data: roles, error: rolesError } = await supabase.from('roles').select('id,key').in('id', assignments.map((assignment) => assignment.role_id));
  if (rolesError || !roles?.length) redirect('/admin/team?error=deactivate');
  if (roles.some((role) => role.key === 'owner')) redirect('/admin/team?error=protected');
  let admin;
  try { admin = createAdminClient(); } catch { redirect('/admin/team?error=configuration'); }
  const { error: banError } = await admin.auth.admin.updateUserById(parsed.data, { ban_duration: '876000h' });
  if (banError) redirect('/admin/team?error=deactivate');
  const { error: revokeError } = await supabase.from('user_roles').delete().eq('user_id', parsed.data);
  if (revokeError) redirect('/admin/team?error=deactivate');
  redirect('/admin/team?updated=deactivated');
}

const zodUserId = z.string().uuid();

export async function updateRolePermissionAction(formData: FormData) {
  const parsed = rolePermissionSchema.safeParse({ roleId: value(formData, 'roleId'), permissionId: value(formData, 'permissionId'), enabled: value(formData, 'enabled') });
  if (!parsed.success) redirect('/admin/team/permissions?error=invalid');
  const { supabase } = await requireOwner();
  const { data: role, error: roleError } = await supabase.from('roles').select('key').eq('id', parsed.data.roleId).maybeSingle();
  const { data: permission, error: permissionError } = await supabase.from('permissions').select('key').eq('id', parsed.data.permissionId).maybeSingle();
  if (roleError || permissionError || !role || !permission) redirect('/admin/team/permissions?error=save');
  if (role.key === 'owner' || role.key === 'customer') redirect('/admin/team/permissions?error=protected');

  if (parsed.data.enabled === 'true') {
    const { error } = await supabase.from('role_permissions').upsert({ role_id: parsed.data.roleId, permission_id: parsed.data.permissionId }, { onConflict: 'role_id,permission_id' });
    if (error) redirect(`/admin/team/permissions?error=${error.code === '42501' ? 'protected' : 'save'}`);
  } else {
    const { error } = await supabase.from('role_permissions').delete().eq('role_id', parsed.data.roleId).eq('permission_id', parsed.data.permissionId);
    if (error) redirect(`/admin/team/permissions?error=${error.code === '42501' ? 'protected' : 'save'}`);
  }
  redirect('/admin/team/permissions?updated=1');
}
