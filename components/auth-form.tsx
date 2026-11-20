import Link from 'next/link';
import { signInAction, signUpAction, requestPasswordResetAction, updatePasswordAction } from '@/app/actions/auth';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
const copy = { login: { submit: 'دخول' }, signup: { submit: 'إنشاء حساب عميل' }, forgot: { submit: 'إرسال رابط الاستعادة' }, reset: { submit: 'حفظ كلمة المرور' } };
const inputClass = 'mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3';

export function AuthForm({ mode, error, sent, next = '/account' }: { mode: AuthMode; error?: string; sent?: boolean; next?: string }) {
  const action = mode === 'login' ? signInAction : mode === 'signup' ? signUpAction : mode === 'forgot' ? requestPasswordResetAction : updatePasswordAction;
  return <form action={action} className="mt-8 space-y-5">
    {(mode === 'login' || mode === 'signup') && <input type="hidden" name="next" value={next} />}
    {mode === 'signup' && <>
      <p className="text-sm leading-6 text-stone-300">التسجيل هنا للعملاء فقط. لإدارة حسابات الموظفين، يستخدم المالك دعوات الإدارة الآمنة.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">الاسم الأول<input name="firstName" required minLength={1} maxLength={80} autoComplete="given-name" className={inputClass} /></label>
        <label className="block text-sm">الاسم الأوسط<input name="middleName" required minLength={1} maxLength={80} autoComplete="additional-name" className={inputClass} /></label>
        <label className="block text-sm">اسم العائلة<input name="lastName" required minLength={1} maxLength={80} autoComplete="family-name" className={inputClass} /></label>
      </div>
      <label className="block text-sm">رقم الهاتف<input name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="01012345678" className={inputClass} /></label>
    </>}
    {(mode === 'login' || mode === 'signup' || mode === 'forgot') && <label className="block text-sm">{mode === 'login' ? 'البريد الإلكتروني أو الهاتف' : 'البريد الإلكتروني'}<input name={mode === 'login' ? 'identifier' : 'email'} type={mode === 'login' ? 'text' : 'email'} required autoComplete={mode === 'login' ? 'username' : 'email'} className={inputClass} /></label>}
    {(mode === 'login' || mode === 'signup' || mode === 'reset') && <label className="block text-sm">كلمة المرور<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} /></label>}
    {mode === 'signup' && <>
      <label className="block text-sm">تأكيد كلمة المرور<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} /></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-stone-300"><input name="acceptedTerms" type="checkbox" value="yes" required className="mt-1 size-4 accent-amber-400" /><span>أوافق على <Link className="text-amber-300 underline" href="/terms" target="_blank" rel="noopener noreferrer">شروط الاستخدام</Link> و<Link className="text-amber-300 underline" href="/privacy" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</Link>.</span></label>
    </>}
    {error === 'reserved' ? <p role="alert" className="text-sm text-red-300">هذا الرقم مخصص لحساب المالك ولا يمكن استخدامه لتسجيل عميل.</p> : error === 'setup' ? <p role="alert" className="text-sm text-red-300">التسجيل غير مهيأ حاليًا، ولم يتم إنشاء حساب. تواصل مع المعرض لإكمال إعداد الخدمة.</p> : error === 'profile' ? <p role="alert" className="text-sm text-red-300">تم إنشاء الحساب لكن تعذّر حفظ ملف العميل. أعد المحاولة لاحقًا أو تواصل مع المعرض.</p> : error && <p role="alert" className="text-sm text-red-300">تعذّر إكمال الطلب. راجع البيانات وحاول مرة أخرى.</p>}
    {sent && <p role="status" className="text-sm text-emerald-300">لو كانت البيانات صالحة، ستصلك رسالة لإكمال الخطوة.</p>}
    <button className="w-full rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">{copy[mode].submit}</button>
  </form>;
}
