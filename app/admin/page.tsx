import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { requireUser, userHasPermission } from '@/lib/auth/permissions';

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!user) redirect('/auth/login?next=/admin');
  const canView = await userHasPermission('view_dashboard');
  if (!canView) return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-10 text-stone-100"><h1 className="text-3xl font-bold">حسابك جاهز</h1><p className="mt-4 text-stone-300">لوحة الموظفين متاحة بعد منح صلاحية مناسبة من مسؤول المعرض.</p><form action={signOutAction}><button className="mt-8 rounded bg-amber-400 px-4 py-2 text-black">تسجيل الخروج</button></form></main>;
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-10 text-stone-100"><h1 className="text-3xl font-bold">لوحة الخيال موتورز</h1><p className="mt-4 text-stone-300">تأسيس النظام مكتمل؛ ستظهر بيانات التشغيل بعد المراحل التالية.</p><form action={signOutAction}><button className="mt-8 rounded bg-amber-400 px-4 py-2 text-black">تسجيل الخروج</button></form></main>;
}
