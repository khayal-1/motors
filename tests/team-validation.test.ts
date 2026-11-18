import { describe, expect, it } from 'vitest';
import { canAssignRole, canEditRolePermissions, roleAssignmentSchema } from '../lib/team/validation';

const validAssignment = {
  userId: '15f7a770-0fcb-41ad-9a31-aec3d954a5a7',
  roleId: '12fd0c4a-0980-4487-a194-839ee7f54f23',
};

describe('staff role management validation', () => {
  it('accepts valid profile and role UUIDs only', () => {
    expect(roleAssignmentSchema.safeParse(validAssignment).success).toBe(true);
    expect(roleAssignmentSchema.safeParse({ ...validAssignment, userId: 'not-an-id' }).success).toBe(false);
  });

  it('allows least-privilege and future roles, but blocks customer and elevated roles for ordinary managers', () => {
    expect(canAssignRole('inventory_employee', ['view_motorcycles'], false)).toBe(true);
    expect(canAssignRole('new_future_role', [], false)).toBe(true);
    expect(canAssignRole('customer', [], true)).toBe(false);
    expect(canAssignRole('owner', [], true)).toBe(false);
    expect(canEditRolePermissions('owner')).toBe(false);
    expect(canEditRolePermissions('customer')).toBe(false);
    expect(canEditRolePermissions('inventory_employee')).toBe(true);
    expect(canAssignRole('manager', ['manage_users'], false)).toBe(false);
    expect(canAssignRole('custom_supervisor', ['manage_permissions'], false)).toBe(false);
    expect(canAssignRole('manager', ['manage_users'], true)).toBe(true);
  });
});
