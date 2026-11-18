import Link from 'next/link';
import { requireCustomer } from '@/lib/auth/permissions';

const statusLabels: Record<string, string> = {
  pending: 'بانتظار المراجعة', in_review: 'قيد المراجعة', approved: 'تمت الموافقة',
  declined: 'غير متاح حاليًا', completed: 'مكتمل', cancelled: 'ملغي',
};

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireCustomer('/requests');
  const [purchases, imports] = await Promise.all([
    supabase.from('purchase_requests').select('id,motorcycle_id,message,status,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('import_requests').select('id,desired_brand,desired_model,year_min,year_max,status,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);
  const unavailable = Boolean(purchases.error || imports.error);
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between border-b border-white/10 pb-5"><Link href="/" className="font-bold">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link><nav className="flex gap-4 text-sm"><Link href="/catalog" className="text-amber-200">الكتالوج</Link><Link href="/requests/import" className="text-stone-300">طلب استيراد</Link></nav></header>
    <h1 className="mt-10 text-3xl font-black">طلباتي</h1>
    {params.created && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4 text-emerald-200">وصل طلبك للمعرض، وستظهر حالته هنا بعد المراجعة.</p>}
    {unavailable ? <p role="status" className="mt-6 rounded-xl border border-amber-300/20 p-5 text-stone-300">عرض الطلبات يحتاج تطبيق ترحيل الطلبات على قاعدة البيانات. لم تتأثر بياناتك.</p> : <>
      <section className="mt-8"><h2 className="text-xl font-bold">طلبات الشراء</h2>{(purchases.data ?? []).length ? <ul className="mt-4 space-y-3">{purchases.data!.map((item) => <li key={item.id} className="rounded-xl border border-white/10 p-4"><p className="font-semibold">طلب استفسار عن دراجة</p><p className="mt-1 text-sm text-stone-400">{statusLabels[item.status] ?? item.status} · {new Date(item.created_at).toLocaleDateString('ar-EG')}</p>{item.message && <p className="mt-3 text-sm text-stone-300">{item.message}</p>}</li>)}</ul> : <p className="mt-3 text-stone-400">لا توجد طلبات شراء بعد.</p>}</section>
      <section className="mt-10"><h2 className="text-xl font-bold">طلبات الاستيراد</h2>{(imports.data ?? []).length ? <ul className="mt-4 space-y-3">{imports.data!.map((item) => <li key={item.id} className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{[item.desired_brand, item.desired_model].filter(Boolean).join(' ')}</p><p className="mt-1 text-sm text-stone-400">{statusLabels[item.status] ?? item.status}{item.year_min || item.year_max ? ` · ${item.year_min ?? '—'}–${item.year_max ?? '—'}` : ''} · {new Date(item.created_at).toLocaleDateString('ar-EG')}</p></li>)}</ul> : <p className="mt-3 text-stone-400">لا توجد طلبات استيراد بعد.</p>}</section>
    </>}
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/catalog" className="rounded-lg border border-white/15 px-4 py-2">اختيار دراجة</Link><Link href="/requests/import" className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black">طلب استيراد</Link></div>
  </div></main>;
}
