import Link from 'next/link';
import { signOutAction } from '@/app/actions/auth';
import { requireCustomer } from '@/lib/auth/permissions';

export default async function CustomerAccountPage() {
  const { supabase, user } = await requireCustomer('/account');
  const { data: profile } = await supabase.from('profiles').select('first_name,middle_name,last_name,phone').eq('id', user.id).maybeSingle();
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-10 text-stone-100"><section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[.03] p-7"><Link href="/" className="text-amber-300">الخيال موتورز</Link><h1 className="mt-5 text-3xl font-black">حساب العميل</h1><p className="mt-3 text-stone-300">مرحبًا {profile?.first_name || user.email || 'بك'}.</p><p className="mt-2 text-sm text-stone-400">{profile?.phone || user.phone || ''}</p><nav className="mt-7 flex flex-wrap gap-3"><Link href="/catalog" className="rounded-lg bg-amber-400 px-4 py-3 font-bold text-black">تصفح الدراجات</Link><Link href="/requests" className="rounded-lg border border-white/15 px-4 py-3">طلباتي</Link></nav><form action={signOutAction} className="mt-7"><button className="text-sm text-stone-400 underline">تسجيل الخروج</button></form></section></main>;
}
