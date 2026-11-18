import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { requireUser, userHasPermission, userIsOwner } from '@/lib/auth/permissions';

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!user) redirect('/auth/login?next=/admin');
  const [canViewDashboard, canViewInventory, canManageUsers, isOwner] = await Promise.all([
    userHasPermission('view_dashboard'),
    userHasPermission('view_motorcycles'),
    userHasPermission('manage_users'),
    userIsOwner(),
  ]);
  if (!canViewDashboard) redirect('/account');
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-10 text-stone-100"><h1 className="text-3xl font-bold">لوحة الخيال موتورز</h1><p className="mt-4 text-stone-300">تأسيس النظام مكتمل؛ ستظهر بيانات التشغيل بعد المراحل التالية.</p>{canViewInventory && <Link href="/admin/inventory" className="mt-6 inline-flex rounded-lg border border-amber-300/40 px-4 py-3 text-amber-200">إدارة المخزون</Link>}{canManageUsers && isOwner && <Link href="/admin/team" className="mt-6 inline-flex rounded-lg border border-amber-300/40 px-4 py-3 text-amber-200">إدارة الفريق والأدوار</Link>}<form action={signOutAction}><button className="mt-8 block rounded bg-amber-400 px-4 py-2 text-black">تسجيل الخروج</button></form></main>;
}
