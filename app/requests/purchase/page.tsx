import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPurchaseRequestAction } from '@/app/actions/requests';
import { requireUser } from '@/lib/auth/permissions';
import { safeNextPath } from '@/lib/auth/redirect';
import { formatPrice, type PublicMotorcycle } from '@/lib/catalog';

const columns = 'id,stock_code,brand,model,year,color,engine_cc,engine_type,price,description,status,created_at';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PurchaseRequestPage({ searchParams }: { searchParams: Promise<{ motorcycle_id?: string; error?: string }> }) {
  const params = await searchParams;
  const motorcycleId = typeof params.motorcycle_id === 'string' ? params.motorcycle_id : '';
  const next = safeNextPath(`/requests/purchase?motorcycle_id=${encodeURIComponent(motorcycleId)}`, '/requests');
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  if (!uuidPattern.test(motorcycleId)) {
    return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><div className="mx-auto max-w-3xl"><RequestsHeader /><h1 className="mt-10 text-3xl font-black">طلب شراء</h1><p className="mt-4 text-stone-300">ابدأ باختيار دراجة من الكتالوج، ثم أرسل طلب الاستفسار عنها.</p><Link href="/catalog" className="mt-6 inline-flex rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">افتح الكتالوج</Link></div></main>;
  }

  const { data } = await supabase.from('public_motorcycle_catalog').select(columns).eq('id', motorcycleId).maybeSingle();
  if (!data) return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><div className="mx-auto max-w-3xl"><RequestsHeader /><h1 className="mt-10 text-3xl font-black">طلب شراء</h1><p className="mt-4 text-stone-300">الدراجة لم تعد معروضة في الكتالوج.</p><Link href="/catalog" className="mt-6 inline-flex text-amber-300 underline">العودة للكتالوج</Link></div></main>;
  const motorcycle = data as PublicMotorcycle;
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><div className="mx-auto max-w-3xl"><RequestsHeader /><section className="mt-10 rounded-2xl border border-white/10 bg-white/[.03] p-6"><p className="text-sm text-amber-300">طلب استفسار — لا يتضمن حجزًا أو التزام شراء</p><h1 className="mt-3 text-3xl font-black">{motorcycle.brand} {motorcycle.model}</h1><p className="mt-2 text-stone-300">{motorcycle.year} · {formatPrice(motorcycle.price)}</p><p className="mt-2 text-sm text-stone-500">كود المخزون: {motorcycle.stock_code}</p></section>
    {params.error && <p role="alert" className="mt-5 rounded-lg border border-rose-300/30 p-4 text-rose-200">تعذّر إرسال الطلب. تحقق من البيانات وحاول مجددًا.</p>}
    <form action={createPurchaseRequestAction} className="mt-6 space-y-5 rounded-2xl border border-white/10 p-6"><input type="hidden" name="motorcycleId" value={motorcycle.id} /><label className="block text-sm">رسالتك للمعرض (اختياري)<textarea name="message" maxLength={1200} rows={4} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" placeholder="اكتب سؤالك أو الوقت المناسب للتواصل" /></label><p className="text-xs leading-6 text-stone-400">سيُرسل الطلب لفريق المعرض لمراجعته. لا يُعتبر تأكيدًا للسعر أو حجزًا للدراجة.</p><button className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">إرسال طلب الاستفسار</button></form>
  </div></main>;
}

function RequestsHeader() {
  return <header className="flex items-center justify-between border-b border-white/10 pb-5"><Link href="/" className="font-bold">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link><nav className="flex gap-4 text-sm"><Link href="/catalog" className="text-amber-200">الكتالوج</Link><Link href="/requests" className="text-stone-300">طلباتي</Link></nav></header>;
}
