import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, userHasPermission } from '@/lib/auth/permissions';
import { formatPrice } from '@/lib/catalog';
import { signOutAction } from '@/app/actions/auth';

const statusNames: Record<string, string> = {
  Available: 'متاحة', Reserved: 'محجوزة', Sold: 'مباعة', Maintenance: 'صيانة',
  Imported: 'مستوردة', 'Coming Soon': 'قريبًا', Hidden: 'مخفية', Archived: 'مؤرشفة',
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=%2Fadmin%2Finventory');
  const canView = await userHasPermission('view_motorcycles');
  if (!canView) redirect('/admin?error=forbidden');

  const { data, error } = await supabase
    .from('motorcycles')
    .select('id,stock_code,brand,model,year,price,purchase_cost,status,engine_number,chassis_number,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const canCreate = await userHasPermission('create_motorcycles');
  const canEdit = await userHasPermission('edit_motorcycles');
  const inventory = data ?? [];

  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100 sm:px-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
      <div><Link href="/admin" className="text-sm text-amber-300">لوحة الإدارة</Link><h1 className="mt-2 text-3xl font-black">إدارة المخزون</h1></div>
      <div className="flex gap-3"><Link href="/catalog" className="rounded-lg border border-white/15 px-4 py-2 text-sm">عرض الكتالوج</Link><form action={signOutAction}><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black">تسجيل الخروج</button></form></div>
    </header>
    {params.created && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4 text-emerald-200">تمت إضافة الدراجة إلى المخزون.</p>}
    {params.updated && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4 text-emerald-200">تم حفظ التعديلات.</p>}
    {params.error === 'notfound' && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 p-4 text-rose-200">لم أجد سجل المخزون المطلوب.</p>}
    {params.error === 'forbidden' && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 p-4 text-rose-200">لا تملك الصلاحية اللازمة.</p>}
    {params.error === 'save' && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 p-4 text-rose-200">تعذّر حفظ التغييرات؛ تحقق من تطبيق ترحيل المخزون وصلاحيات الحساب.</p>}
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-stone-400">يعرض الجدول آخر 100 سجل. لا تُضاف أي دراجات افتراضية.</p>{canCreate && <Link href="/admin/inventory/new" className="rounded-lg bg-amber-400 px-4 py-3 font-bold text-black">إضافة دراجة</Link>}</div>
    {error ? <section role="status" className="mt-6 rounded-xl border border-amber-300/20 p-5 text-stone-300">تعذّر تحميل المخزون. قد يحتاج هذا المشروع إلى تطبيق migration الأساس أو منح حسابك صلاحية عرض المخزون.</section> : inventory.length === 0 ? <section className="mt-6 rounded-2xl border border-white/10 p-8"><h2 className="text-xl font-bold">المخزون فارغ حاليًا</h2><p className="mt-2 text-stone-400">تظهر هنا السجلات الموجودة فعلًا في قاعدة البيانات.</p></section> : <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-full text-right text-sm"><thead className="bg-white/[.04] text-stone-300"><tr>{['كود المخزون','الماركة والموديل','السنة','الحالة','سعر البيع','إجراء'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{inventory.map((item) => <tr key={item.id} className="hover:bg-white/[.025]"><td className="whitespace-nowrap px-4 py-4 font-mono text-stone-300">{item.stock_code}</td><td className="px-4 py-4 font-semibold">{item.brand} {item.model}</td><td className="px-4 py-4">{item.year}</td><td className="px-4 py-4">{statusNames[item.status] ?? item.status}</td><td className="whitespace-nowrap px-4 py-4 text-amber-200">{formatPrice(item.price)}</td><td className="px-4 py-4">{canEdit ? <Link href={`/admin/inventory/${item.id}/edit`} className="text-amber-300 underline underline-offset-4">تعديل</Link> : '—'}</td></tr>)}</tbody></table></div>}
  </div></main>;
}
