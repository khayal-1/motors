import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser, userHasPermission } from '@/lib/auth/permissions';
import { InventoryForm, InventoryFormError } from '@/components/inventory-form';
import { inventoryIdSchema } from '@/lib/inventory/validation';

export default async function EditMotorcyclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const validId = inventoryIdSchema.safeParse(id);
  if (!validId.success) notFound();
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/admin/inventory/${id}/edit`)}`);
  if (!(await userHasPermission('view_motorcycles')) || !(await userHasPermission('edit_motorcycles'))) redirect('/admin?error=forbidden');

  const { data: item, error } = await supabase.from('motorcycles')
    .select('id,stock_code,brand,model,year,color,engine_cc,engine_type,engine_number,chassis_number,price,purchase_cost,description,status')
    .eq('id', validId.data).maybeSingle();
  if (error || !item) notFound();

  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100"><div className="mx-auto max-w-4xl"><Link href="/admin/inventory" className="text-sm text-amber-300">العودة للمخزون</Link><h1 className="mt-4 text-3xl font-black">تعديل {item.brand} {item.model}</h1><p className="mt-2 text-sm text-stone-400">كود المخزون: {item.stock_code}</p><InventoryFormError code={query.error} /><InventoryForm item={item} /></div></main>;
}
