'use server';

import { redirect } from 'next/navigation';
import { requireUser, userHasPermission } from '@/lib/auth/permissions';
import { inventoryIdSchema, inventoryMotorcycleSchema } from '@/lib/inventory/validation';

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === 'string' ? field : '';
}

function payload(formData: FormData) {
  return inventoryMotorcycleSchema.safeParse({
    stockCode: value(formData, 'stockCode'),
    brand: value(formData, 'brand'),
    model: value(formData, 'model'),
    year: value(formData, 'year'),
    color: value(formData, 'color'),
    engineCc: value(formData, 'engineCc'),
    engineType: value(formData, 'engineType'),
    engineNumber: value(formData, 'engineNumber'),
    chassisNumber: value(formData, 'chassisNumber'),
    price: value(formData, 'price'),
    purchaseCost: value(formData, 'purchaseCost'),
    description: value(formData, 'description'),
    status: value(formData, 'status'),
  });
}

function databaseError(error: { code?: string }) {
  if (error.code === '23505') return 'duplicate';
  if (error.code === '23514' || error.code === '22P02') return 'invalid';
  return 'save';
}

export async function createMotorcycleAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const returnTo = '/admin/inventory/new';
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`);
  if (!(await userHasPermission('create_motorcycles'))) redirect('/admin?error=forbidden');

  const parsed = payload(formData);
  if (!parsed.success) redirect(`${returnTo}?error=invalid`);

  const { error } = await supabase.from('motorcycles').insert({
    stock_code: parsed.data.stockCode,
    brand: parsed.data.brand,
    model: parsed.data.model,
    year: parsed.data.year,
    color: parsed.data.color,
    engine_cc: parsed.data.engineCc ?? null,
    engine_type: parsed.data.engineType,
    engine_number: parsed.data.engineNumber,
    chassis_number: parsed.data.chassisNumber,
    price: parsed.data.price,
    purchase_cost: parsed.data.purchaseCost,
    description: parsed.data.description,
    status: parsed.data.status,
    created_by: user.id,
    updated_by: user.id,
  });
  if (error) redirect(`${returnTo}?error=${databaseError(error)}`);
  redirect('/admin/inventory?created=1');
}

export async function updateMotorcycleAction(formData: FormData) {
  const id = value(formData, 'id');
  const validId = inventoryIdSchema.safeParse(id);
  const returnTo = validId.success ? `/admin/inventory/${validId.data}/edit` : '/admin/inventory';
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(returnTo)}`);
  if (!(await userHasPermission('edit_motorcycles'))) redirect('/admin?error=forbidden');
  if (!validId.success) redirect('/admin/inventory?error=notfound');

  const parsed = payload(formData);
  if (!parsed.success) redirect(`${returnTo}?error=invalid`);

  const { data, error } = await supabase.from('motorcycles').update({
    stock_code: parsed.data.stockCode,
    brand: parsed.data.brand,
    model: parsed.data.model,
    year: parsed.data.year,
    color: parsed.data.color,
    engine_cc: parsed.data.engineCc ?? null,
    engine_type: parsed.data.engineType,
    engine_number: parsed.data.engineNumber,
    chassis_number: parsed.data.chassisNumber,
    price: parsed.data.price,
    purchase_cost: parsed.data.purchaseCost,
    description: parsed.data.description,
    status: parsed.data.status,
    updated_by: user.id,
  }).eq('id', validId.data).select('id').maybeSingle();
  if (error) redirect(`${returnTo}?error=${databaseError(error)}`);
  if (!data) redirect('/admin/inventory?error=notfound');
  redirect('/admin/inventory?updated=1');
}
