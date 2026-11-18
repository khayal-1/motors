import { provisionInitialOwnerAction } from '@/app/actions/owner-bootstrap';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };
import { createAdminClient } from '@/lib/supabase/admin';

export default async function InitialOwnerSetupPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  const params = await searchParams;
  let configured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OWNER_BOOTSTRAP_TOKEN && process.env.OWNER_BOOTSTRAP_PHONE);
  let alreadyProvisioned = false;
  if (configured) {
    try {
      const admin = createAdminClient();
      const { data: ownerRole, error } = await admin.from('roles').select('id').eq('key', 'owner').maybeSingle();
      if (error || !ownerRole) configured = false;
      else {
        const { data: owners, error: ownerError } = await admin.from('user_roles').select('user_id').eq('role_id', ownerRole.id).limit(1);
        if (ownerError) configured = false;
        else alreadyProvisioned = Boolean(owners?.length);
      }
    } catch {
      configured = false;
    }
  }
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-12 text-stone-100"><section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-7">
    <h1 className="text-3xl font-black">تهيئة المالك الأول</h1>
    <p className="mt-4 leading-7 text-stone-300">مسار إعداد داخلي لمرة واحدة؛ لا يظهر في تسجيل العملاء. لا تتابع إلا بعد ضبط مفاتيح الخادم الآمنة وبيانات المشروع المقصود.</p>
    {params.done ? <p role="status" className="mt-6 text-emerald-200">اكتملت التهيئة الأولية. سجّل الدخول برقم الهاتف وكلمة المرور التي اخترتها.</p>
      : alreadyProvisioned || params.error === 'used' ? <p role="status" className="mt-6 text-amber-200">تم استخدام التهيئة الأولية بالفعل؛ هذا المسار مغلق.</p>
      : !configured ? <p role="alert" className="mt-6 text-amber-200">مسار التهيئة غير مُعدّ للخادم أو قاعدة البيانات. لن يُنشأ أي حساب.</p>
      : <>
        {params.error && <p role="alert" className="mt-5 text-rose-200">تعذّر إكمال التهيئة؛ راجع إعداد الخادم أو ترحيل التهيئة، ولا تُعد المحاولة قبل التحقق من حالة الحساب.</p>}
        <form action={provisionInitialOwnerAction} className="mt-6 space-y-4">
          <label className="block text-sm text-stone-300">رمز التهيئة لمرة واحدة<input name="token" type="password" required minLength={32} autoComplete="off" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label>
          <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm text-stone-300">الاسم الأول<input name="firstName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label><label className="text-sm text-stone-300">الاسم الأوسط<input name="middleName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label><label className="text-sm text-stone-300">اسم العائلة<input name="lastName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label></div>
          <label className="block text-sm text-stone-300">كلمة مرور المالك<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label>
          <label className="block text-sm text-stone-300">تأكيد كلمة المرور<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3" /></label>
          <label className="flex items-start gap-3 text-sm leading-6 text-stone-300"><input name="acceptedTerms" type="checkbox" value="yes" required className="mt-1 size-4 accent-amber-400" /><span>أوافق على <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">الشروط</a> و<a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">سياسة الخصوصية</a>.</span></label>
          <button className="w-full rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">تهيئة حساب المالك لمرة واحدة</button>
        </form>
      </>}
  </section></main>;
}
