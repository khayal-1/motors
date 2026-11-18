import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, userHasPermission } from '@/lib/auth/permissions';
import { InventoryForm, InventoryFormError } from '@/components/inventory-form';

export default async function NewMotorcyclePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { user } = await requireUser();
  if (!user) redirect('/auth/login?next=%2Fadmin%2Finventory%2Fnew');
  if (!(await userHasPermission('create_motorcycles'))) redirect('/admin?error=forbidden');
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100"><div className="mx-auto max-w-4xl"><Link href="/admin/inventory" className="text-sm text-amber-300">العودة للمخزون</Link><h1 className="mt-4 text-3xl font-black">إضافة دراجة للمخزون</h1><p className="mt-3 leading-7 text-stone-400">أدخل بيانات السجل الفعلية. لا ننشئ سجلات تجريبية أو قيمًا بديلة.</p><InventoryFormError code={params.error} /><InventoryForm /></div></main>;
}
