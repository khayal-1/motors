import Link from 'next/link';

export default function HomePage() {
  return <main className="min-h-screen bg-[#0a0d10] text-stone-100">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Link href="/" className="text-xl font-bold tracking-wide">EL KHAYAL <span className="text-amber-400">MOTOR&apos;S</span></Link>
      <nav className="flex items-center gap-5 text-sm text-stone-300"><Link href="/catalog">الموتوسيكلات</Link><Link href="/auth/login">تسجيل الدخول</Link><Link href="/auth/signup" className="rounded-lg border border-amber-300/40 px-3 py-2 text-amber-200">إنشاء حساب</Link></nav>
    </header>
    <section className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-6 py-20 md:grid-cols-2">
      <div><p className="mb-4 text-sm tracking-[.22em] text-amber-400">الخيال موتورز · خبرة وثقة</p>
        <h1 className="max-w-xl text-5xl font-black leading-tight md:text-7xl">اختار رحلتك<br/><span className="text-amber-400">من هنا.</span></h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-stone-300">منصة متكاملة لعرض وإدارة الدراجات النارية. نجهّز الأساس الآن، وسيُضاف كتالوج المخزون بعد إعداد قاعدة البيانات.</p>
        <Link className="mt-8 inline-flex rounded-md bg-amber-400 px-6 py-3 font-bold text-black" href="/catalog">استكشف الكتالوج</Link>
      </div>
      <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-stone-800 via-neutral-900 to-black p-8">
        <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative text-center"><div className="text-8xl">🏍</div><p className="mt-4 text-sm tracking-[.3em] text-stone-400">BUILT FOR THE OPEN ROAD</p></div>
      </div>
    </section>
    <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-stone-500">El Khayal Motor&apos;s · الخيال موتورز</footer>
  </main>;
}
