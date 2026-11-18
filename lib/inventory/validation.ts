import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const numberFromForm = (schema: z.ZodType<number>) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  schema,
);
const optionalInteger = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? Number(value) : value,
  z.number().int().min(1).max(10000).optional(),
);

export const motorcycleStatuses = [
  'Available', 'Reserved', 'Sold', 'Maintenance', 'Imported', 'Coming Soon', 'Hidden', 'Archived',
] as const;

export const inventoryMotorcycleSchema = z.object({
  stockCode: text(40),
  brand: text(80),
  model: text(100),
  year: numberFromForm(z.number().int().min(1900).max(2200)),
  color: optionalText(50),
  engineCc: optionalInteger,
  engineType: optionalText(60),
  engineNumber: text(80),
  chassisNumber: text(80),
  price: numberFromForm(z.number().finite().min(0).max(1_000_000_000)),
  purchaseCost: numberFromForm(z.number().finite().min(0).max(1_000_000_000)),
  description: z.string().trim().max(2000).optional().transform((value) => value ?? ''),
  status: z.enum(motorcycleStatuses),
});

export const inventoryIdSchema = z.string().uuid();
export type InventoryMotorcycleInput = z.infer<typeof inventoryMotorcycleSchema>;
