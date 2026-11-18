import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
const optionalInteger = (min: number, max: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? Number(value) : value,
  z.number().int().min(min).max(max).optional(),
);
const optionalMoney = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? Number(value) : value,
  z.number().finite().min(0).max(1_000_000_000).optional(),
);

export const purchaseRequestSchema = z.object({
  motorcycleId: z.string().uuid(),
  message: z.string().trim().max(1200).optional().transform((value) => value ?? ''),
});

export const importRequestSchema = z.object({
  desiredBrand: optionalText(80),
  desiredModel: optionalText(100),
  yearMin: optionalInteger(1900, 2200),
  yearMax: optionalInteger(1900, 2200),
  engineCcMin: optionalInteger(1, 10000),
  engineCcMax: optionalInteger(1, 10000),
  budgetMinEgp: optionalMoney,
  budgetMaxEgp: optionalMoney,
  notes: z.string().trim().max(1600).optional().transform((value) => value ?? ''),
}).refine((data) => Boolean(data.desiredBrand || data.desiredModel), {
  message: 'أدخل الماركة أو الموديل على الأقل.',
  path: ['desiredBrand'],
}).refine((data) => data.yearMin == null || data.yearMax == null || data.yearMin <= data.yearMax, {
  message: 'السنة من يجب ألا تتجاوز السنة إلى.',
  path: ['yearMin'],
}).refine((data) => data.engineCcMin == null || data.engineCcMax == null || data.engineCcMin <= data.engineCcMax, {
  message: 'السعة من يجب ألا تتجاوز السعة إلى.',
  path: ['engineCcMin'],
}).refine((data) => data.budgetMinEgp == null || data.budgetMaxEgp == null || data.budgetMinEgp <= data.budgetMaxEgp, {
  message: 'الميزانية الدنيا يجب ألا تتجاوز العليا.',
  path: ['budgetMinEgp'],
});
