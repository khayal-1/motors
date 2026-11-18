import { signInAction, signUpAction, requestPasswordResetAction, updatePasswordAction } from '@/app/actions/auth';
type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
const copy = { login: { submit: 'دخول' }, signup: { submit: 'إنشاء الحساب' }, forgot: { submit: 'إرسال رابط الاستعادة' }, reset: { submit: 'حفظ كلمة المرور' } };
export function AuthForm({ mode, error, sent, next = '/admin' }: { mode: AuthMode; error?: string; sent?: boolean; next?: string }) {
  const action = mode === 'login' ? signInAction : mode === 'signup' ? signUpAction : mode === 'forgot' ? requestPasswordResetAction : updatePasswordAction;
  return <form action={action} className="mt-8 space-y-5">
    {(mode === 'login' || mode === 'signup') && <input type="hidden" name="next" value={next} />}
    {mode === 'signup' && <label className="block text-sm">الاسم<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label>}
    {mode !== 'reset' && <label className="block text-sm">البريد الإلكتروني<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label>}
    {(mode === 'login' || mode === 'signup' || mode === 'reset') && <label className="block text-sm">كلمة المرور<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3" /></label>}
    {error && <p role="alert" className="text-sm text-red-300">تعذّر إكمال الطلب. راجع البيانات وحاول مرة أخرى.</p>}
    {sent && <p role="status" className="text-sm text-emerald-300">لو كان البريد صالحًا، ستصلك رسالة لإكمال الخطوة.</p>}
    <button className="w-full rounded-lg bg-amber-400 px-5 py-3 font-bold text-black">{copy[mode].submit}</button>
  </form>;
}
