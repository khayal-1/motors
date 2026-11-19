import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { updateClientProfileAction, updateCustomerEmailAction } from '@/app/actions/client';
import { requireCustomer } from '@/lib/auth/permissions';

type AccountPageProps = { searchParams: Promise<{ error?: string; updated?: string; email?: string }> };

export default async function CustomerAccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const { supabase, user } = await requireCustomer('/account');
  const { data: client, error } = await supabase.from('clients')
    .select('name,first_name,middle_name,last_name,phone,address')
    .eq('user_id', user.id).maybeSingle();
  const errors: Record<string, string> = {
    profile: 'تعذّر حفظ بيانات العميل. راجع رقم الهاتف وحاول مرة أخرى.',
    email: 'تعذّر طلب تغيير البريد الإلكتروني. راجع العنوان وحاول مرة أخرى.',
  };
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[.03] p-7">
    <Link href="/" className="text-amber-300">الخيال موتورز</Link>
    <h1 className="mt-5 text-3xl font-black">حساب العميل</h1>
    <p className="mt-3 text-stone-300">مرحبًا {client?.first_name || client?.name || user.email || 'بك'}.</p>
    {!client || error ? <p role="status" className="mt-5 rounded-lg border border-amber-300/20 p-4 text-amber-100">بيانات العميل غير متاحة حتى تطبيق تحديث قاعدة البيانات.</p> : <>
      {params.updated && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 p-4 text-emerald-200">تم حفظ بياناتك.</p>}
      {params.email === 'sent' && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 p-4 text-emerald-200">أرسلت Supabase رسالة تأكيد للبريد الجديد؛ سيظل بريد الدخول الحالي فعالًا حتى تأكيده.</p>}
      {params.error && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 p-4 text-rose-200">{errors[params.error] ?? 'تعذّر إكمال التغيير.'}</p>}
      <form action={updateClientProfileAction} className="mt-7 grid gap-4 sm:grid-cols-3">
        <label className="text-sm text-stone-300">الاسم الأول<input name="firstName" required maxLength={80} defaultValue={client.first_name} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <label className="text-sm text-stone-300">الاسم الأوسط<input name="middleName" required maxLength={80} defaultValue={client.middle_name} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <label className="text-sm text-stone-300">اسم العائلة<input name="lastName" required maxLength={80} defaultValue={client.last_name} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <label className="text-sm text-stone-300 sm:col-span-3">رقم الهاتف<input name="phone" type="tel" required defaultValue={client.phone ?? ''} autoComplete="tel" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <label className="text-sm text-stone-300 sm:col-span-3">العنوان<input name="address" maxLength={500} defaultValue={client.address} autoComplete="street-address" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <button className="rounded-lg bg-amber-400 px-4 py-3 font-bold text-black sm:col-span-3">حفظ بيانات العميل</button>
      </form>
      <form action={updateCustomerEmailAction} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm text-stone-300">بريد الدخول (تديره Supabase Auth)<input name="email" type="email" required defaultValue={user.email ?? ''} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3" /></label>
        <button className="rounded-lg border border-white/15 px-4 py-3">طلب تغيير البريد</button>
      </form>
    </>}
    <nav className="mt-7 flex flex-wrap gap-3"><Link href="/catalog" className="rounded-lg bg-amber-400 px-4 py-3 font-bold text-black">تصفح الدراجات</Link><Link href="/requests" className="rounded-lg border border-white/15 px-4 py-3">طلباتي</Link></nav>
    <form action={signOutAction} className="mt-7"><button className="text-sm text-stone-400 underline">تسجيل الخروج</button></form>
  </section></main>;
}
