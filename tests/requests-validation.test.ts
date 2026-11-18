import { describe, expect, it } from 'vitest';
import { importRequestSchema, purchaseRequestSchema } from '../lib/requests/validation';

const uuid = '00000000-0000-4000-8000-000000000001';

describe('customer request validation', () => {
  it('accepts a purchase inquiry only with a valid catalog id', () => {
    expect(purchaseRequestSchema.safeParse({ motorcycleId: uuid, message: '  Can I visit?  ' }).success).toBe(true);
    expect(purchaseRequestSchema.safeParse({ motorcycleId: 'not-a-uuid', message: '' }).success).toBe(false);
  });

  it('requires an import target and trims optional text', () => {
    expect(importRequestSchema.safeParse({ desiredBrand: '', desiredModel: '' }).success).toBe(false);
    const parsed = importRequestSchema.parse({ desiredBrand: ' Honda ', desiredModel: '', notes: '  red  ' });
    expect(parsed.desiredBrand).toBe('Honda');
    expect(parsed.notes).toBe('red');
  });

  it('rejects reversed year, engine and budget ranges', () => {
    expect(importRequestSchema.safeParse({ desiredBrand: 'Honda', yearMin: '2024', yearMax: '2020' }).success).toBe(false);
    expect(importRequestSchema.safeParse({ desiredBrand: 'Honda', engineCcMin: '1000', engineCcMax: '500' }).success).toBe(false);
    expect(importRequestSchema.safeParse({ desiredBrand: 'Honda', budgetMinEgp: '200000', budgetMaxEgp: '100000' }).success).toBe(false);
  });

  it('allows an open-ended import request with optional ranges omitted', () => {
    expect(importRequestSchema.safeParse({ desiredModel: 'CB 500', yearMin: '', yearMax: '', budgetMinEgp: '' }).success).toBe(true);
  });
});
