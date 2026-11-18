import { z } from 'zod';

export const roleAssignmentSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const rolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  enabled: z.enum(['true', 'false']),
});

export const staffInviteSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(254),
  roleId: z.string().uuid(),
});

const protectedPermissions = new Set(['manage_users', 'manage_permissions']);

export function canAssignRole(roleKey: string, permissionKeys: readonly string[], canManagePermissions: boolean): boolean {
  if (roleKey === 'customer' || roleKey === 'owner') return false;
  return canManagePermissions || !permissionKeys.some((permission) => protectedPermissions.has(permission));
}

export function canEditRolePermissions(roleKey: string): boolean {
  return roleKey !== 'owner' && roleKey !== 'customer';
}
