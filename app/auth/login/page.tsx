import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { safeNextPath } from '@/lib/auth/redirect';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: requestedNext } = await searchParams;
  const next = safeNextPath(requestedNext, '/account');
  return <main className="min-h-screen bg-[#0a0d10] px-6 py-16 text-stone-100"><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[.03] p-8"><Link href="/" className="text-amber-400">الخيال موتورز</Link><h1 className="mt-6 text-3xl font-bold">تسجيل الدخول</h1><AuthForm mode="login" error={error} next={next} /><div className="mt-6 flex justify-between text-sm text-stone-300"><Link href="/auth/forgot-password">نسيت كلمة المرور؟</Link><Link href={`/auth/signup?next=${encodeURIComponent(next)}`}>إنشاء حساب</Link></div></section></main>;
}
