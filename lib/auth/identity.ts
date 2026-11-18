import { z } from 'zod';

export function normalizePhone(value: string): string {
  const compact = value.replace(/[\s().-]/g, '');
  if (/^01(?:0|1|2|5)\d{8}$/.test(compact)) return `+20${compact.slice(1)}`;
  if (/^20(?:10|11|12|15)\d{8}$/.test(compact)) return `+${compact}`;
  if (/^\+20(?:10|11|12|15)\d{8}$/.test(compact)) return compact;
  return compact;
}

export const egyptianPhoneSchema = z.string().trim().transform(normalizePhone).pipe(
  z.string().regex(/^\+20(?:10|11|12|15)\d{8}$/, 'Enter a valid Egyptian mobile number.'),
);
export const personNamePart = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u);
export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(8).max(128);
export const policyVersion = '2026-11-18-v1';

export const customerSignupSchema = z.object({
  firstName: personNamePart,
  middleName: personNamePart,
  lastName: personNamePart,
  phone: egyptianPhoneSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
  acceptedTerms: z.literal(true),
}).refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'] });

export function loginCredentials(identifier: string, password: string) {
  if (identifier.includes('@')) {
    const email = emailSchema.safeParse(identifier);
    return email.success ? { email: email.data, password } : null;
  }
  const phone = egyptianPhoneSchema.safeParse(identifier);
  return phone.success ? { phone: phone.data, password } : null;
}
