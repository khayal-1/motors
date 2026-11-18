import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { safeNextPath } from '@/lib/auth/redirect';
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  return <main className="min-h-screen bg-[#0a0d10] px-6 py-16 text-stone-100"><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[.03] p-8"><Link href="/" className="text-amber-400">الخيال موتورز</Link><h1 className="mt-6 text-3xl font-bold">إنشاء حساب عميل</h1><AuthForm mode="signup" error={params.error} sent={params.sent === '1'} next={next} /><p className="mt-6 text-sm text-stone-300">لديك حساب؟ <Link className="text-amber-400" href={`/auth/login?next=${encodeURIComponent(next)}`}>تسجيل الدخول</Link></p></section></main>;
}
