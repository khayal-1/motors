import { describe, expect, it } from 'vitest';
import { inventoryMotorcycleSchema, motorcycleStatuses } from '../lib/inventory/validation';

const validMotorcycle = {
  stockCode: 'KM-001',
  brand: 'Honda',
  model: 'CB500',
  year: '2024',
  color: 'Black',
  engineCc: '500',
  engineType: '4-stroke',
  engineNumber: 'ENGINE-001',
  chassisNumber: 'FRAME-001',
  price: '250000',
  purchaseCost: '210000',
  description: 'Imported motorcycle',
  status: 'Available',
};

describe('staff inventory validation', () => {
  it('normalizes form numbers and optional blank fields', () => {
    const parsed = inventoryMotorcycleSchema.parse({ ...validMotorcycle, color: '  Black  ', engineCc: '', engineType: '' });
    expect(parsed.year).toBe(2024);
    expect(parsed.engineCc).toBeUndefined();
    expect(parsed.color).toBe('Black');
    expect(parsed.engineType).toBeNull();
  });

  it('requires a stock code, brand, model and both serial identifiers', () => {
    for (const key of ['stockCode', 'brand', 'model', 'engineNumber', 'chassisNumber'] as const) {
      expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, [key]: ' ' }).success).toBe(false);
    }
  });

  it('rejects out-of-range years, negative prices and non-integer engine capacity', () => {
    expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, year: '1800' }).success).toBe(false);
    expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, price: '-1' }).success).toBe(false);
    expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, engineCc: '500.5' }).success).toBe(false);
  });

  it('accepts only inventory statuses already defined by the database schema', () => {
    expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, status: 'Available' }).success).toBe(true);
    expect(inventoryMotorcycleSchema.safeParse({ ...validMotorcycle, status: 'Published' }).success).toBe(false);
    expect(motorcycleStatuses).toContain('Archived');
  });
});
