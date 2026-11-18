import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatMotorcycleStatus, formatPrice, sanitizeCatalogSearch, type PublicMotorcycle } from '@/lib/catalog';

const PAGE_SIZE = 12;
const CATALOG_COLUMNS = 'id,stock_code,brand,model,year,color,engine_cc,engine_type,price,description,status,created_at';

type CatalogPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

function pageHref(page: number, q: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return suffix ? `/catalog?${suffix}` : '/catalog';
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const rawQuery = typeof params.q === 'string' ? params.q : '';
  const query = sanitizeCatalogSearch(rawQuery);
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage) ? Math.max(1, Math.min(requestedPage, 10000)) : 1;
  const from = (currentPage - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let request = supabase
    .from('public_motorcycle_catalog')
    .select(CATALOG_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (query) {
    const pattern = `%${query}%`;
    request = request.or(`brand.ilike.${pattern},model.ilike.${pattern},stock_code.ilike.${pattern}`);
  }

  const { data, error, count } = await request;
  const motorcycles = (data ?? []) as PublicMotorcycle[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageIsOutOfRange = currentPage > totalPages && (count ?? 0) > 0;

  return (
    <main className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="text-lg font-bold tracking-wide">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link>
          <nav className="flex items-center gap-5 text-sm text-stone-300" aria-label="التنقل الرئيسي">
            <Link href="/catalog" aria-current="page" className="text-amber-300">الكتالوج</Link>
            <Link href="/auth/login">دخول الموظفين</Link>
          </nav>
        </header>

        <section className="py-12 sm:py-16">
          <p className="text-sm font-semibold tracking-[.18em] text-amber-400">الخيال موتورز</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">كتالوج الموتوسيكلات</h1>
          <p className="mt-4 max-w-2xl leading-8 text-stone-300">تصفّح الدراجات المتاحة والقادمة، وابحث بالماركة أو الموديل أو كود المخزون.</p>

          <form action="/catalog" method="get" className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label htmlFor="catalog-search" className="sr-only">ابحث في الكتالوج</label>
            <input
              id="catalog-search"
              name="q"
              type="search"
              maxLength={80}
              defaultValue={rawQuery}
              placeholder="مثال: Honda أو كود المخزون"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-stone-100 outline-none placeholder:text-stone-500 focus:border-amber-400"
            />
            <button type="submit" className="min-h-12 rounded-xl bg-amber-400 px-7 font-bold text-neutral-950 transition hover:bg-amber-300">ابحث</button>
          </form>
          {rawQuery && !query && <p className="mt-3 text-sm text-amber-200">اكتب اسم الماركة أو الموديل أو كود المخزون باستخدام الحروف والأرقام.</p>}
        </section>

        {error ? (
          <section role="status" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-6 text-stone-200">
            تعذّر تحميل الكتالوج الآن. حاول تحديث الصفحة بعد قليل.
          </section>
        ) : pageIsOutOfRange ? (
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-center">
            <h2 className="text-xl font-bold">هذه الصفحة غير موجودة</h2>
            <Link href={pageHref(totalPages, query)} className="mt-4 inline-flex text-amber-300 underline underline-offset-4">اذهب لآخر صفحة متاحة</Link>
          </section>
        ) : motorcycles.length === 0 ? (
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.06] to-white/[.02] p-8 sm:p-12">
            <p className="text-sm font-semibold text-amber-300">الكتالوج مرتبط بالمخزون الفعلي</p>
            <h2 className="mt-3 text-2xl font-bold">{query ? 'لا توجد نتائج مطابقة' : 'لا توجد دراجات معروضة حاليًا'}</h2>
            <p className="mt-3 max-w-xl leading-7 text-stone-300">
              {query ? 'جرّب كلمة بحث أخرى، أو امسح البحث لعرض كل ما هو متاح.' : 'ستظهر هنا الدراجات التي يضيفها فريق المعرض ويعتمد عرضها. لا نعرض بيانات غير موجودة في المخزون.'}
            </p>
            {query && <Link href="/catalog" className="mt-5 inline-flex rounded-lg border border-amber-300/50 px-4 py-2 text-amber-200">عرض الكتالوج كاملًا</Link>}
          </section>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-400">
              <p>{count ?? motorcycles.length} نتيجة{query ? ` عن «${query}»` : ''}</p>
              <p>الأسعار بالجنيه المصري</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="نتائج الكتالوج">
              {motorcycles.map((bike) => (
                <li key={bike.id}>
                  <article className="h-full rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-0.5 hover:border-amber-300/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-stone-500">{bike.stock_code}</p>
                        <h2 className="mt-2 text-xl font-bold">{bike.brand} {bike.model}</h2>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${bike.status === 'Coming Soon' ? 'bg-sky-300/10 text-sky-200' : 'bg-emerald-300/10 text-emerald-200'}`}>
                        {formatMotorcycleStatus(bike.status)}
                      </span>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-stone-500">السنة</dt><dd className="mt-1">{bike.year}</dd></div>
                      {bike.engine_cc != null && <div><dt className="text-stone-500">سعة المحرك</dt><dd className="mt-1">{bike.engine_cc} cc</dd></div>}
                      {bike.color && <div><dt className="text-stone-500">اللون</dt><dd className="mt-1">{bike.color}</dd></div>}
                    </dl>
                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                      <p className="font-bold text-amber-300">{formatPrice(bike.price)}</p>
                      <Link href={`/catalog/${bike.id}`} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:border-amber-300/50">التفاصيل</Link>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-4" aria-label="صفحات الكتالوج">
                {currentPage > 1 ? <Link href={pageHref(currentPage - 1, query)} className="rounded-lg border border-white/15 px-4 py-2">السابق</Link> : <span className="rounded-lg border border-white/5 px-4 py-2 text-stone-600">السابق</span>}
                <span className="text-sm text-stone-400">{currentPage} من {totalPages}</span>
                {currentPage < totalPages ? <Link href={pageHref(currentPage + 1, query)} className="rounded-lg border border-white/15 px-4 py-2">التالي</Link> : <span className="rounded-lg border border-white/5 px-4 py-2 text-stone-600">التالي</span>}
              </nav>
            )}
          </>
        )}

        <footer className="mt-16 border-t border-white/10 py-6 text-center text-sm text-stone-500">El Khayal Motor&apos;s · الخيال موتورز</footer>
      </div>
    </main>
  );
}
