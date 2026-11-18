import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="min-h-screen bg-[#0a0d10] px-6 py-16 text-stone-100"><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[.03] p-8"><Link href="/" className="text-amber-400">الخيال موتورز</Link><h1 className="mt-6 text-3xl font-bold">تعيين كلمة مرور جديدة</h1><p className="mt-3 text-sm text-stone-300">افتح رابط الاستعادة بالبريد أولًا، ثم احفظ كلمة المرور الجديدة هنا.</p><AuthForm mode="reset" error={error} /></section></main>;
}
