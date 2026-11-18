import Link from 'next/link';
import { createImportRequestAction } from '@/app/actions/requests';
import { requireCustomer } from '@/lib/auth/permissions';

export default async function ImportRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  await requireCustomer('/requests/import');
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><div className="mx-auto max-w-3xl"><header className="flex items-center justify-between border-b border-white/10 pb-5"><Link href="/" className="font-bold">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link><nav className="flex gap-4 text-sm"><Link href="/catalog" className="text-amber-200">الكتالوج</Link><Link href="/requests" className="text-stone-300">طلباتي</Link></nav></header>
    <h1 className="mt-10 text-3xl font-black">طلب استيراد</h1><p className="mt-3 leading-7 text-stone-300">اكتب المواصفات التي تبحث عنها؛ سيتواصل فريق المعرض بعد مراجعة طلبك. إرسال الطلب لا يعني تأكيد التوفر أو السعر.</p>
    {params.error && <p role="alert" className="mt-5 rounded-lg border border-rose-300/30 p-4 text-rose-200">تعذّر إرسال الطلب. أدخل الماركة أو الموديل على الأقل، وراجع نطاقات السنوات والميزانية.</p>}
    <form action={createImportRequestAction} className="mt-7 space-y-5 rounded-2xl border border-white/10 p-6">
      <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm">الماركة<input name="desiredBrand" maxLength={80} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label><label className="text-sm">الموديل<input name="desiredModel" maxLength={100} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label></div>
      <fieldset><legend className="text-sm text-stone-300">سنة الصنع (اختياري)</legend><div className="mt-2 grid gap-5 sm:grid-cols-2"><label className="text-sm">من<input name="yearMin" type="number" min={1900} max={2200} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label><label className="text-sm">إلى<input name="yearMax" type="number" min={1900} max={2200} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label></div></fieldset>
      <fieldset><legend className="text-sm text-stone-300">سعة المحرك (cc، اختياري)</legend><div className="mt-2 grid gap-5 sm:grid-cols-2"><label className="text-sm">من<input name="engineCcMin" type="number" min={1} max={10000} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label><label className="text-sm">إلى<input name="engineCcMax" type="number" min={1} max={10000} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label></div></fieldset>
      <fieldset><legend className="text-sm text-stone-300">الميزانية بالجنيه المصري (اختياري)</legend><div className="mt-2 grid gap-5 sm:grid-cols-2"><label className="text-sm">من<input name="budgetMinEgp" type="number" min={0} step="0.01" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label><label className="text-sm">إلى<input name="budgetMaxEgp" type="number" min={0} step="0.01" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label></div></fieldset>
      <label className="block text-sm">تفاصيل إضافية<textarea name="notes" maxLength={1600} rows={4} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label>
      <button className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">إرسال طلب الاستيراد</button>
    </form>
  </div></main>;
}
