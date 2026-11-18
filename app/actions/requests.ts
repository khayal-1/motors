'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/permissions';
import { safeNextPath } from '@/lib/auth/redirect';
import { importRequestSchema, purchaseRequestSchema } from '@/lib/requests/validation';

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function createPurchaseRequestAction(formData: FormData) {
  const motorcycleId = formValue(formData, 'motorcycleId');
  const next = safeNextPath(`/requests/purchase?motorcycle_id=${encodeURIComponent(motorcycleId)}`, '/requests');
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);

  const parsed = purchaseRequestSchema.safeParse({
    motorcycleId,
    message: formValue(formData, 'message'),
  });
  if (!parsed.success) redirect(`${next}&error=invalid`);

  const { error } = await supabase.from('purchase_requests').insert({
    customer_id: user.id,
    motorcycle_id: parsed.data.motorcycleId,
    message: parsed.data.message,
    status: 'pending',
  });
  if (error) redirect(`${next}&error=save`);
  redirect('/requests?created=purchase');
}

export async function createImportRequestAction(formData: FormData) {
  const next = '/requests/import';
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);

  const parsed = importRequestSchema.safeParse({
    desiredBrand: formValue(formData, 'desiredBrand'),
    desiredModel: formValue(formData, 'desiredModel'),
    yearMin: formValue(formData, 'yearMin'),
    yearMax: formValue(formData, 'yearMax'),
    engineCcMin: formValue(formData, 'engineCcMin'),
    engineCcMax: formValue(formData, 'engineCcMax'),
    budgetMinEgp: formValue(formData, 'budgetMinEgp'),
    budgetMaxEgp: formValue(formData, 'budgetMaxEgp'),
    notes: formValue(formData, 'notes'),
  });
  if (!parsed.success) redirect(`${next}?error=invalid`);

  const { error } = await supabase.from('import_requests').insert({
    customer_id: user.id,
    desired_brand: parsed.data.desiredBrand,
    desired_model: parsed.data.desiredModel,
    year_min: parsed.data.yearMin ?? null,
    year_max: parsed.data.yearMax ?? null,
    engine_cc_min: parsed.data.engineCcMin ?? null,
    engine_cc_max: parsed.data.engineCcMax ?? null,
    budget_min_egp: parsed.data.budgetMinEgp ?? null,
    budget_max_egp: parsed.data.budgetMaxEgp ?? null,
    notes: parsed.data.notes,
    status: 'pending',
  });
  if (error) redirect(`${next}?error=save`);
  redirect('/requests?created=import');
}
