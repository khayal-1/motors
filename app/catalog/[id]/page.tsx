import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatMotorcycleStatus, formatPrice, type PublicMotorcycle } from '@/lib/catalog';

const CATALOG_COLUMNS = 'id,stock_code,brand,model,year,color,engine_cc,engine_type,price,description,status,created_at';

export default async function MotorcycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('public_motorcycle_catalog')
    .select(CATALOG_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (!data && !error) notFound();
  if (error) {
    return <main className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100 sm:px-8"><div className="mx-auto max-w-4xl"><Link href="/catalog" className="text-amber-300">← العودة للكتالوج</Link><p role="status" className="mt-8 rounded-2xl border border-rose-300/20 p-6">تعذّر تحميل تفاصيل الدراجة الآن. حاول تحديث الصفحة بعد قليل.</p></div></main>;
  }

  const bike = data as PublicMotorcycle;
  return (
    <main className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100 sm:px-8">
      <article className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="text-lg font-bold">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link>
          <Link href="/catalog" className="text-sm text-amber-300">الكتالوج</Link>
        </header>
        <div className="py-10">
          <Link href="/catalog" className="text-sm text-stone-400 hover:text-amber-300">← العودة للكتالوج</Link>
          <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.06] to-white/[.02] p-6 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-stone-400">كود المخزون: {bike.stock_code}</p>
              <span className={`rounded-full px-3 py-1 text-sm ${bike.status === 'Coming Soon' ? 'bg-sky-300/10 text-sky-200' : 'bg-emerald-300/10 text-emerald-200'}`}>{formatMotorcycleStatus(bike.status)}</span>
            </div>
            <h1 className="mt-5 text-4xl font-black sm:text-5xl">{bike.brand} {bike.model}</h1>
            <p className="mt-4 text-2xl font-bold text-amber-300">{formatPrice(bike.price)}</p>
            <dl className="mt-8 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-2">
              <div><dt className="text-sm text-stone-500">السنة</dt><dd className="mt-2 text-lg">{bike.year}</dd></div>
              {bike.color && <div><dt className="text-sm text-stone-500">اللون</dt><dd className="mt-2 text-lg">{bike.color}</dd></div>}
              {bike.engine_cc != null && <div><dt className="text-sm text-stone-500">سعة المحرك</dt><dd className="mt-2 text-lg">{bike.engine_cc} cc</dd></div>}
              {bike.engine_type && <div><dt className="text-sm text-stone-500">نوع المحرك</dt><dd className="mt-2 text-lg">{bike.engine_type}</dd></div>}
            </dl>
            {bike.description && <section className="mt-8 border-t border-white/10 pt-7"><h2 className="text-lg font-bold">التفاصيل</h2><p className="mt-3 whitespace-pre-line leading-8 text-stone-300">{bike.description}</p></section>}
            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6"><Link href={`/requests/purchase?motorcycle_id=${bike.id}`} className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">استفسر عن الشراء</Link><p className="text-sm leading-7 text-stone-400">الطلب لا يحجز الدراجة ولا يلزمك بالشراء. لا تُعرض بيانات الشاسيه أو المحرك التسلسلية.</p></div>
          </div>
        </div>
        <footer className="border-t border-white/10 py-6 text-center text-sm text-stone-500">El Khayal Motor&apos;s · الخيال موتورز</footer>
      </article>
    </main>
  );
}
