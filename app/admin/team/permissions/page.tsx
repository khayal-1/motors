import Link from 'next/link';
import { redirect } from 'next/navigation';
import { updateRolePermissionAction } from '@/app/actions/team';
import { requireUser, userHasPermission, userIsOwner } from '@/lib/auth/permissions';
import { signOutAction } from '@/app/actions/auth';
import { canEditRolePermissions } from '@/lib/team/validation';

export default async function RolePermissionsPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fteam%2Fpermissions');
  if (!(await userHasPermission('manage_users')) || !(await userIsOwner())) redirect('/admin?error=forbidden');
  const [rolesResult, permissionsResult, mappingsResult] = await Promise.all([
    supabase.from('roles').select('id,key,name_ar').order('name_ar'),
    supabase.from('permissions').select('id,key,description').order('key'),
    supabase.from('role_permissions').select('role_id,permission_id'),
  ]);
  if (rolesResult.error || permissionsResult.error || mappingsResult.error) return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-8 text-stone-100"><p role="alert">تعذّر تحميل صلاحيات الأدوار؛ تحقق من ترحيل إدارة الفريق.</p></main>;
  const roles = (rolesResult.data ?? []).filter((role) => canEditRolePermissions(role.key));
  const permissions = permissionsResult.data ?? [];
  const assigned = new Set((mappingsResult.data ?? []).map((mapping) => `${mapping.role_id}:${mapping.permission_id}`));
  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"><div><Link href="/admin/team" className="text-sm text-amber-300">إدارة الفريق</Link><h1 className="mt-2 text-3xl font-black">صلاحيات الأدوار</h1></div><form action={signOutAction}><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black">تسجيل الخروج</button></form></header>
    <p className="mt-5 max-w-4xl leading-7 text-stone-400">المالك وحده يغيّر صلاحيات الأدوار. دور المالك والعميل محميان ولا يظهران للتعديل، كما أن إدارة الفريق وقواعد RLS تتحقق من المالك حتى لو عُيّنت صلاحية مماثلة لدور آخر.</p>
    {params.error && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 p-4 text-rose-200">{params.error === 'protected' ? 'هذا الدور محمي.' : 'تعذّر حفظ الصلاحية؛ تحقق من الترحيل.'}</p>}
    {params.updated && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 p-4 text-emerald-200">تم حفظ تغيير الصلاحية.</p>}
    <div className="mt-6 grid gap-5">{roles.map((role) => <section key={role.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-bold">{role.name_ar} <span className="font-mono text-sm text-stone-500">{role.key}</span></h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{permissions.map((permission) => {
      const enabled = assigned.has(`${role.id}:${permission.id}`);
      return <form key={permission.id} action={updateRolePermissionAction} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-3"><input type="hidden" name="roleId" value={role.id} /><input type="hidden" name="permissionId" value={permission.id} /><input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} /><div><p className="font-mono text-sm text-amber-200">{permission.key}</p><p className="mt-1 text-xs text-stone-400">{permission.description || 'صلاحية قابلة للتوسعة'}</p></div><button className={`min-w-24 rounded-lg px-3 py-2 text-sm font-semibold ${enabled ? 'border border-emerald-300/30 text-emerald-200' : 'border border-white/15 text-stone-300'}`}>{enabled ? 'مفعّلة · إيقاف' : 'غير مفعّلة · تفعيل'}</button></form>;
    })}</div></section>)}</div>
  </div></main>;
}
