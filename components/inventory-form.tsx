import Link from 'next/link';
import { createMotorcycleAction, updateMotorcycleAction } from '@/app/actions/inventory';
import { motorcycleStatuses } from '@/lib/inventory/validation';

export type InventoryFormValues = {
  id?: string;
  stock_code?: string;
  brand?: string;
  model?: string;
  year?: number | null;
  color?: string | null;
  engine_cc?: number | null;
  engine_type?: string | null;
  engine_number?: string;
  chassis_number?: string;
  price?: number | string;
  purchase_cost?: number | string;
  description?: string | null;
  status?: string;
};

const fieldClass = 'mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#11161a] px-3 text-stone-100 outline-none focus:border-amber-400';
const labelClass = 'block text-sm text-stone-300';

export function InventoryForm({ item }: { item?: InventoryFormValues }) {
  const editing = Boolean(item?.id);
  return (
    <form action={editing ? updateMotorcycleAction : createMotorcycleAction} className="mt-7 space-y-6">
      {editing && <input type="hidden" name="id" value={item!.id} />}
      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:grid-cols-2">
        <label className={labelClass}>كود المخزون<input className={fieldClass} name="stockCode" maxLength={40} required defaultValue={item?.stock_code ?? ''} /></label>
        <label className={labelClass}>الماركة<input className={fieldClass} name="brand" maxLength={80} required defaultValue={item?.brand ?? ''} /></label>
        <label className={labelClass}>الموديل<input className={fieldClass} name="model" maxLength={100} required defaultValue={item?.model ?? ''} /></label>
        <label className={labelClass}>سنة الصنع<input className={fieldClass} name="year" type="number" min={1900} max={2200} step={1} required defaultValue={item?.year ?? ''} /></label>
        <label className={labelClass}>اللون<input className={fieldClass} name="color" maxLength={50} defaultValue={item?.color ?? ''} /></label>
        <label className={labelClass}>سعة المحرك (cc)<input className={fieldClass} name="engineCc" type="number" min={1} max={10000} step={1} defaultValue={item?.engine_cc ?? ''} /></label>
        <label className={labelClass}>نوع المحرك<input className={fieldClass} name="engineType" maxLength={60} defaultValue={item?.engine_type ?? ''} /></label>
        <label className={labelClass}>الحالة<select className={fieldClass} name="status" defaultValue={item?.status ?? 'Available'}>{motorcycleStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      </section>
      <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:grid-cols-2">
        <label className={labelClass}>رقم المحرك<input className={fieldClass} name="engineNumber" maxLength={80} required defaultValue={item?.engine_number ?? ''} /></label>
        <label className={labelClass}>رقم الشاسيه<input className={fieldClass} name="chassisNumber" maxLength={80} required defaultValue={item?.chassis_number ?? ''} /></label>
        <label className={labelClass}>سعر البيع (جنيه مصري)<input className={fieldClass} name="price" type="number" min={0} max={1000000000} step="0.01" required defaultValue={item?.price ?? ''} /></label>
        <label className={labelClass}>تكلفة الشراء (جنيه مصري)<input className={fieldClass} name="purchaseCost" type="number" min={0} max={1000000000} step="0.01" required defaultValue={item?.purchase_cost ?? ''} /></label>
        <label className={`${labelClass} sm:col-span-2`}>الوصف<textarea className={`${fieldClass} min-h-28 py-3`} name="description" maxLength={2000} defaultValue={item?.description ?? ''} /></label>
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="min-h-11 rounded-lg bg-amber-400 px-5 font-bold text-neutral-950 hover:bg-amber-300">{editing ? 'حفظ التعديلات' : 'إضافة للمخزون'}</button>
        <Link href="/admin/inventory" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-5 text-stone-300">إلغاء</Link>
      </div>
    </form>
  );
}

export function InventoryFormError({ code }: { code?: string }) {
  if (!code) return null;
  const messages: Record<string, string> = {
    invalid: 'راجع الحقول؛ بعض القيم غير مكتملة أو خارج النطاق المسموح.',
    duplicate: 'كود المخزون أو رقم المحرك أو الشاسيه مستخدم بالفعل.',
    save: 'تعذّر حفظ الدراجة. تأكد من أن ترحيل المخزون مطبّق وأن لديك الصلاحية.',
  };
  return <p role="alert" className="mt-6 rounded-lg border border-rose-300/20 bg-rose-300/5 p-4 text-rose-200">{messages[code] ?? 'تعذّر تنفيذ العملية.'}</p>;
}
