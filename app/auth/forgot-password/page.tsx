import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return <main className="min-h-screen bg-[#0a0d10] px-6 py-16 text-stone-100"><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[.03] p-8"><Link href="/" className="text-amber-400">الخيال موتورز</Link><h1 className="mt-6 text-3xl font-bold">استعادة كلمة المرور</h1><AuthForm mode="forgot" error={params.error} sent={params.sent === '1'} /></section></main>;
}
