import { describe, expect, it } from 'vitest';
import { customerSignupSchema, egyptianPhoneSchema, loginCredentials, normalizePhone, personNamePart } from '../lib/auth/identity';

describe('auth identity inputs', () => {
  it('normalizes Egyptian phone forms to Supabase E.164', () => {
    expect(normalizePhone('010 1234 5678')).toBe('+201012345678');
    expect(egyptianPhoneSchema.parse('01012345678')).toBe('+201012345678');
    expect(egyptianPhoneSchema.parse('+201012345678')).toBe('+201012345678');
  });

  it('rejects malformed or unsupported numbers', () => {
    expect(egyptianPhoneSchema.safeParse('123').success).toBe(false);
    expect(egyptianPhoneSchema.safeParse('+12025550123').success).toBe(false);
  });

  it('selects email or normalized phone authentication without exposing account lookup data', () => {
    expect(loginCredentials('person@example.com', 'pass12345')).toEqual({ email: 'person@example.com', password: 'pass12345' });
    expect(loginCredentials('01012345678', 'pass12345')).toEqual({ phone: '+201012345678', password: 'pass12345' });
    expect(loginCredentials('bad-phone', 'pass12345')).toBeNull();
  });

  it('requires all three name parts, phone, email, matching passwords and explicit policy acceptance', () => {
    const registration = { firstName: 'علي', middleName: 'حسن', lastName: 'محمد', phone: '01012345678', email: 'customer@example.com', password: 'password123', confirmPassword: 'password123', acceptedTerms: true };
    expect(customerSignupSchema.safeParse(registration).success).toBe(true);
    expect(customerSignupSchema.safeParse({ ...registration, middleName: '' }).success).toBe(false);
    expect(customerSignupSchema.safeParse({ ...registration, confirmPassword: 'different123' }).success).toBe(false);
    expect(customerSignupSchema.safeParse({ ...registration, acceptedTerms: false }).success).toBe(false);
  });

  it('requires one non-empty name part', () => {
    expect(personNamePart.safeParse('علي').success).toBe(true);
    expect(personNamePart.safeParse(' ').success).toBe(false);
  });
});
