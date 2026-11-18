import Link from 'next/link';
export default function CatalogPage() {
  return <main className="min-h-screen bg-[#0a0d10] px-6 py-20 text-stone-100"><div className="mx-auto max-w-5xl">
    <Link href="/" className="text-amber-400">الخيال موتورز</Link><h1 className="mt-8 text-4xl font-bold">كتالوج الموتوسيكلات</h1>
    <p className="mt-4 text-stone-300">سيظهر المخزون هنا بعد تنفيذ مرحلة إدارة الموتوسيكلات وربط البيانات.</p>
  </div></main>;
}
