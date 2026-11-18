import Link from 'next/link';
import { redirect } from 'next/navigation';
import { assignStaffRoleAction, deactivateStaffAction, inviteStaffAction, removeStaffRoleAction } from '@/app/actions/team';
import { requireUser, userHasPermission, userIsOwner } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { signOutAction } from '@/app/actions/auth';

type TeamPageProps = { searchParams: Promise<{ error?: string; updated?: string; page?: string }> };
const errors: Record<string, string> = {
  invalid: 'راجع الاسم الثلاثي، الهاتف، البريد، والدور المختار.', duplicate: 'هذا الدور مسند بالفعل لهذا الحساب.',
  protected: 'التغيير محمي أو لا تملك الصلاحية اللازمة.', notfound: 'لم أجد حساب الموظف أو إسناد الدور.',
  invite: 'تعذّر إرسال الدعوة أو تجهيز الحساب؛ راجع إعداد بريد Supabase.', configuration: 'إدارة الحسابات تحتاج إعداد مفتاح الخادم الآمن قبل التشغيل.', deactivate: 'لم تكتمل إيقاف الحساب وإزالة صلاحياته؛ أعد المراجعة قبل إعادة المحاولة.',
  save: 'تعذّر تحميل البيانات أو حفظ التغيير. تحقق من ترحيل إدارة الفريق وصلاحيات المالك.',
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const { supabase, user } = await requireUser();
  if (!user) redirect('/auth/login?next=%2Fadmin%2Fteam');
  if (!(await userHasPermission('manage_users')) || !(await userIsOwner())) redirect('/admin?error=forbidden');

  const [rolesResult, assignmentsResult] = await Promise.all([
    supabase.from('roles').select('id,key,name_ar,name_en').order('name_ar'),
    supabase.from('user_roles').select('user_id,role_id,assigned_at'),
  ]);
  if (rolesResult.error || assignmentsResult.error) return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-8 text-stone-100"><p role="alert">تعذّر تحميل الفريق. تحقق من تطبيق ترحيل إدارة الفريق.</p></main>;
  const roles = rolesResult.data ?? [];
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  type StaffAssignment = NonNullable<typeof assignmentsResult.data>[number];
  const assignmentsByUser = new Map<string, StaffAssignment[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const role = rolesById.get(assignment.role_id);
    if (!role || ['customer', 'owner'].includes(role.key)) continue;
    assignmentsByUser.set(assignment.user_id, [...(assignmentsByUser.get(assignment.user_id) ?? []), assignment]);
  }
  const allStaffIds = [...assignmentsByUser.entries()]
    .sort((left, right) => {
      const latest = (rows: StaffAssignment[]) => Math.max(...rows.map((row) => new Date(row.assigned_at).getTime()));
      return latest(right[1]) - latest(left[1]);
    })
    .map(([id]) => id);
  const totalPages = Math.max(1, Math.ceil(allStaffIds.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const staffIds = allStaffIds.slice((page - 1) * pageSize, page * pageSize);
  const profilesResult = staffIds.length
    ? await supabase.from('profiles').select('id,display_name,first_name,middle_name,last_name,phone,created_at').in('id', staffIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (profilesResult.error) return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-8 text-stone-100"><p role="alert">تعذّر تحميل ملفات الفريق.</p></main>;
  const permissionsByRole = await Promise.all(roles.map(async (role) => {
    const { data: mappings } = await supabase.from('role_permissions').select('permission_id').eq('role_id', role.id);
    const permissionIds = (mappings ?? []).map((mapping) => mapping.permission_id);
    const { data: permissionRows } = permissionIds.length ? await supabase.from('permissions').select('key').in('id', permissionIds) : { data: [] };
    return [role.id, (permissionRows ?? []).map((permission) => permission.key)] as const;
  }));
  const keysByRole = new Map(permissionsByRole);
  const assignableRoles = roles.filter((role) => !['owner', 'customer'].includes(role.key));
  let admin;
  try { admin = createAdminClient(); } catch { return <main dir="rtl" className="min-h-screen bg-[#0a0d10] p-8 text-stone-100"><p role="alert">إدارة حسابات الفريق تحتاج إعداد المفتاح الإداري للخادم فقط.</p></main>; }
  const accountResults = await Promise.all(staffIds.map(async (id) => {
    const { data } = await admin.auth.admin.getUserById(id);
    return [id, data.user ? {
      email: data.user.email ?? '',
      confirmed: Boolean(data.user.email_confirmed_at || data.user.phone_confirmed_at),
      disabled: Boolean(data.user.banned_until && new Date(data.user.banned_until) > new Date()),
      lastSignIn: data.user.last_sign_in_at ?? null,
    } : null] as const;
  }));
  const accountById = new Map(accountResults);
  const activityResult = await supabase.from('audit_logs')
    .select('id,actor_id,action,entity_id,new_data,old_data,created_at')
    .in('entity', ['user_roles', 'role_permissions'])
    .order('created_at', { ascending: false })
    .limit(40);
  const messages: Record<string, string> = {
    invited: 'أُرسلت دعوة الموظف بالبريد وأُسند الدور.', assigned: 'تم إسناد الدور.', removed: 'تمت إزالة الدور.', deactivated: 'تم إيقاف حساب الموظف وإزالة أدواره.',
  };

  return <main dir="rtl" className="min-h-screen bg-[#0a0d10] px-5 py-8 text-stone-100 sm:px-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"><div><Link href="/admin" className="text-sm text-amber-300">لوحة الإدارة</Link><h1 className="mt-2 text-3xl font-black">إدارة الموظفين والأدوار</h1></div><div className="flex flex-wrap gap-3"><Link href="/admin/team/permissions" className="rounded-lg border border-amber-300/30 px-4 py-2 text-sm text-amber-200">صلاحيات الأدوار</Link><form action={signOutAction}><button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black">تسجيل الخروج</button></form></div></header>
    <p className="mt-5 max-w-4xl leading-7 text-stone-400">هذه المساحة للمالك فقط. أرسل دعوة بالبريد لموظف، وأسند له دورًا موجودًا، أو أوقف حسابه؛ لا يوجد تسجيل عام للموظفين ولا يُنشأ أي حساب تلقائيًا.</p>
    {params.updated && <p role="status" className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4 text-emerald-200">{messages[params.updated] ?? 'تم حفظ التغيير.'}</p>}
    {params.error && <p role="alert" className="mt-5 rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-rose-200">{errors[params.error] ?? 'تعذّر تنفيذ العملية.'}</p>}
    <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="text-xl font-bold">دعوة موظف</h2><form action={inviteStaffAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm text-stone-300">الاسم الأول<input name="firstName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100" /></label>
      <label className="text-sm text-stone-300">الاسم الأوسط<input name="middleName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100" /></label>
      <label className="text-sm text-stone-300">اسم العائلة<input name="lastName" required maxLength={80} className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100" /></label>
      <label className="text-sm text-stone-300">رقم الهاتف<input name="phone" type="tel" required placeholder="01012345678" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100" /></label>
      <label className="text-sm text-stone-300">البريد الإلكتروني<input name="email" type="email" required autoComplete="off" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100" /></label>
      <label className="text-sm text-stone-300">الدور<select name="roleId" required defaultValue="" className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100"><option value="" disabled>اختر دورًا</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name_ar} ({role.key})</option>)}</select></label>
      <button className="min-h-11 rounded-lg bg-amber-400 px-4 font-bold text-neutral-950 sm:col-span-2 lg:col-span-3">إرسال دعوة وإسناد الدور</button>
    </form></section>
    <section className="mt-8"><h2 className="text-xl font-bold">الفريق المسجل</h2><p className="mt-2 text-sm text-stone-400">{allStaffIds.length} حساب موظف؛ تعرض هذه الصفحة {staffIds.length} حسابًا مع حالة التفعيل وآخر دخول المتاح.</p>
      {!profilesResult.data?.length ? <div className="mt-4 rounded-2xl border border-white/10 p-7 text-stone-400">لا توجد حسابات موظفين لها أدوار حاليًا.</div> : <div className="mt-4 grid gap-4">{profilesResult.data.map((profile) => {
        const staffRoles = assignmentsByUser.get(profile.id) ?? [];
        const account = accountById.get(profile.id);
        return <article key={profile.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-bold">{profile.first_name || profile.display_name || 'اسم غير مسجل'} {profile.middle_name} {profile.last_name}</h3><p className="mt-1 text-sm text-stone-400">{account?.email || 'بريد غير متاح'} · {profile.phone || 'هاتف غير مسجل'}</p><p className="mt-1 font-mono text-xs text-stone-500">{profile.id}</p></div><div className="text-left text-xs text-stone-400"><p>{account?.disabled ? 'موقوف' : account?.confirmed ? 'مفعّل' : 'بانتظار تأكيد البريد'}</p><p className="mt-1">آخر دخول: {account?.lastSignIn ? new Date(account.lastSignIn).toLocaleString('ar-EG') : 'لا يوجد دخول مسجل'}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2">{staffRoles.map((assignment) => { const role = rolesById.get(assignment.role_id); if (!role) return null; return <span key={role.id} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm">{role.name_ar}<form action={removeStaffRoleAction}><input type="hidden" name="userId" value={profile.id} /><input type="hidden" name="roleId" value={role.id} /><button className="text-rose-300" aria-label={`إزالة دور ${role.name_ar}`}>إزالة</button></form></span>; })}</div>
          {!account?.disabled && <div className="mt-4 flex flex-wrap gap-3"><form action={assignStaffRoleAction} className="flex flex-wrap gap-2"><input type="hidden" name="userId" value={profile.id} /><select name="roleId" required defaultValue="" className="min-h-10 rounded-lg border border-white/15 bg-[#11161a] px-3 text-sm text-stone-100"><option value="" disabled>إسناد دور إضافي</option>{assignableRoles.filter((candidate) => !staffRoles.some((assignment) => assignment.role_id === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name_ar}</option>)}</select><button className="rounded-lg border border-amber-300/30 px-3 py-2 text-sm text-amber-200">إسناد</button></form><form action={deactivateStaffAction}><input type="hidden" name="userId" value={profile.id} /><button className="rounded-lg border border-rose-300/25 px-3 py-2 text-sm text-rose-200">إيقاف الحساب وإزالة الأدوار</button></form></div>}
          <details className="mt-4"><summary className="cursor-pointer text-sm text-amber-200">أدوار هذا الحساب</summary><ul className="mt-2 space-y-1 text-sm text-stone-300">{staffRoles.map((assignment) => { const role = rolesById.get(assignment.role_id); return role ? <li key={role.id}>{role.name_ar} ({role.key}): {(keysByRole.get(role.id) ?? []).join('، ') || 'بلا صلاحيات'}</li> : null; })}</ul></details>
        </article>;
      })}</div>}
      {totalPages > 1 && <nav aria-label="صفحات الفريق" className="mt-5 flex items-center justify-between text-sm"><span>الصفحة {page} من {totalPages}</span><div className="flex gap-3">{page > 1 && <Link href={`/admin/team?page=${page - 1}`} className="rounded-lg border border-white/15 px-3 py-2">السابق</Link>}{page < totalPages && <Link href={`/admin/team?page=${page + 1}`} className="rounded-lg border border-white/15 px-3 py-2">التالي</Link>}</div></nav>}
    </section>
    <section className="mt-10"><h2 className="text-xl font-bold">سجل تغييرات الأدوار والصلاحيات</h2><p className="mt-2 text-sm text-stone-400">آخر 40 تغييرًا موثقًا للمالك.</p>
      {activityResult.error ? <p role="status" className="mt-4 text-amber-200">تعذّر تحميل سجل التغييرات؛ تحقق من ترحيل إدارة الفريق.</p> : !activityResult.data?.length ? <p className="mt-4 text-stone-400">لا توجد تغييرات مسجلة.</p> : <ul className="mt-4 space-y-2">{activityResult.data.map((event) => {
        const data = (event.new_data ?? event.old_data ?? {}) as Record<string, unknown>;
        const label = event.action === 'user_role.assigned' ? 'إسناد دور' : event.action === 'user_role.removed' ? 'إزالة دور' : event.action === 'role_permission.granted' ? 'منح صلاحية' : event.action === 'role_permission.revoked' ? 'سحب صلاحية' : 'تغيير صلاحية';
        const detail = [data.role_key, data.permission_key].filter((part): part is string => typeof part === 'string').join(' · ');
        return <li key={event.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm"><span className="font-semibold">{label}{detail ? ` · ${detail}` : ''}</span><p className="mt-1 text-xs text-stone-400">الحساب/الدور: {event.entity_id} · المنفذ: {event.actor_id ?? 'تهيئة نظامية'} · {new Date(event.created_at).toLocaleString('ar-EG')}</p></li>;
      })}</ul>}
    </section>
  </div></main>;
}
