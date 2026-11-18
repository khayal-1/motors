# El Khayal Motor's — الخيال موتورز

أساس منصة عربية RTL لمعرض دراجات نارية، مبني بـ Next.js App Router وTypeScript وTailwind CSS وSupabase. يشمل الأساس الآمن وSupabase Auth وRBAC والكتالوج العام، مع تدفقات طلب استفسار شراء وطلب استيراد للعملاء. لا توجد بيانات مخزون أو عملاء مصطنعة، ولا يوجد دفع/حجز بيع إلكتروني.

## المرحلة الحالية وما يتضمنه الأساس

- واجهة عربية RTL متجاوبة، وكتالوج عام متصل بالمخزون الفعلي مع حالة فارغة عند عدم وجود دراجات منشورة.
- إعداد Supabase للمتصفح والخادم باستخدام `@supabase/ssr` ومفتاح Publishable فقط.
- تدفقات التسجيل، الدخول، الخروج، طلب استعادة كلمة المرور، وتحديثها؛ التحقق من المدخلات بواسطة Zod.
- تحديث جلسة auth عبر middleware. فحص المستخدم والصلاحية على الخادم، إضافةً إلى RLS في PostgreSQL.
- أدوار وصلاحيات قابلة للتوسعة (جداول مرتبطة بدل enum ثابت)، وتعيين تلقائي لدور Customer للمستخدم الجديد.
- Migration أولي فيه profiles وRBAC وmotorcycles وmotorcycle_media وaudit_logs وسياسات RLS وفهارس للأرقام المعرّفة.
- عرض عام `public_motorcycle_catalog` لا يعرض تكلفة الشراء أو أرقام الشاسيه/الموتور.
- `/requests/purchase` و`/requests/import` لإنشاء طلبات العملاء، و`/requests` لعرض طلبات المستخدم الحالي فقط.
- Migration طلبات العملاء `supabase/migrations/20261118190000_customer_requests.sql` يحتوي قيودًا وفهارس وRLS؛ ملفه محفوظ في المستودع ولم يُطبق على Supabase الحي.

راجع `docs/implementation-plan.md` لشرح المرحلة قبل تنفيذها وخطوات المراحل التالية ومخاطرها واختبارها.

## التشغيل المحلي

المتطلبات: Node.js 20.9+ وpnpm 11.9.0 (أو Corepack لتوفيره).

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# املأ بيانات مشروع Supabase العامة في .env.local
pnpm dev
```

تفتح الواجهة على `http://localhost:3000`.

## متغيرات البيئة

- `NEXT_PUBLIC_SUPABASE_URL`: عنوان مشروع Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: مفتاح Publishable/anon العام الخاص بالمشروع؛ يظهر في المتصفح بطبيعته.
- `NEXT_PUBLIC_SITE_URL`: أصل التطبيق المستخدم في روابط التحقق والاستعادة؛ محليًا `http://localhost:3000`، وفي النشر عنوان الموقع الفعلي.

لا تضف Service Role Key أو مفاتيح سرية إلى متغير يبدأ بـ `NEXT_PUBLIC_`. ملف `.env.local` مستثنى من Git. `.env.example` يحتوي أسماء المتغيرات وقيمًا بديلة فقط. لا تُضمّن مفاتيح حقيقية في commits.

## Supabase وقاعدة البيانات

الأساس في `supabase/migrations/20261118180000_foundation.sql` طُبّق مرة واحدة يدويًا على مشروع Supabase المقصود بعد التأكد من خلوه. سجل الترحيل في CLI لم تتم مزامنته بعد. لا تعِد تشغيل هذا الملف ولا تستخدم `db push` قبل إصلاح سجل الترحيل بحساب ومشروع موثّقين. ترحيل الطلبات الجديد محفوظ في `supabase/migrations/20261118190000_customer_requests.sql` ولم يُطبق على قاعدة البيانات الحية. قبل أي تطبيق راجع المشروع المستهدف، النسخة الاحتياطية، إعدادات Auth، وسياسات الوصول. مثال أوامر CLI عام بعد تأكيد ربط الهوية والمشروع وتسوية السجل:

في بيئة CLI موثّقة ومربوطة بالمشروع نفسه، مزامنة سجل الترحيل التأسيسي تكون tracking-only، ولا تعيد تنفيذ SQL:

```bash
npx supabase migration repair 20261118180000 --status applied --remote
npx supabase migration list --remote
```

لا يُطبّق أي migration تلقائيًا من التطبيق. لا تستخدم `db push` حتى تتأكد من سجل الترحيلات ومن المشروع المقصود، ثم راجع migration الطلبات قبل تطبيقه. لم يُطبق ترحيل الطلبات على المشروع الحي. لا تُرسل مفاتيح أو كلمات مرور في الشات أو Git.

الجداول الأولية:

- `profiles`: معلومات أساسية مرتبطة بـ `auth.users`.
- `roles`, `permissions`, `role_permissions`, `user_roles`: نظام RBAC قابل لإضافة أدوار وصلاحيات جديدة.
- `motorcycles`: بيانات المخزون وتكاليف الشراء وحالة المركبة مع uniqueness بعد تطبيع أرقام الشاسيه والموتور.
- `motorcycle_media`: بيانات وصفية ومرجع provider محايد؛ لا توجد خدمة تخزين/Telegram مضافة الآن.
- `audit_logs`: سجل append-only من جهة مستخدمي Postgres، ولا تسمح سياسات العميل بإضافة/تعديل/حذف مباشر.
- `purchase_requests`, `import_requests`: طلبات العملاء؛ العميل ينشئ pending ويقرأ طلباته، وقراءة ومعالجة كل الطلبات تتطلب `manage_requests`.

تفعّل RLS على الجداول. function `has_permission()` تستعلم عن صلاحية المستخدم الحالي من الأدوار المعينة. المستخدم الجديد يحصل على Customer فقط. لا يمنح migration حسابًا دور Owner تلقائيًا؛ بعد تسجيل حساب المالك والتحقق منه، يجب تعيين أول Owner عبر إجراء إداري موثق ومراجع في بيئة Supabase الآمنة. لا تستخدم Service Role في المتصفح.

العرض العام `public_motorcycle_catalog` محدود الأعمدة والحالة، ولا يعرض `purchase_cost` أو `engine_number` أو `chassis_number`. صفحة الكتالوج تقرأ هذا العرض وتوضح الحالة الفارغة عند عدم وجود مخزون منشور. صفحات الطلبات جاهزة برمجيًا، لكنها تحتاج تطبيق migration الجديدة قبل حفظ الطلبات في المشروع الحي.

## المصادقة والصلاحيات

المسارات الحالية:

- `/`: صفحة العلامة الرئيسية.
- `/catalog`: كتالوج عام قابل للبحث والترقيم، ويقرأ العرض العام محدود الأعمدة؛ يعرض حالة فارغة إذا لم توجد دراجات منشورة.
- `/auth/signup`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`.
- `/auth/callback`: تبادل رمز Auth والتحويل إلى مسار داخلي آمن فقط. تسجيل الدخول والتسجيل يحفظان `next` الداخلي كي يعود العميل إلى وجهته، مع رفض الروابط الخارجية ومسارات حلقة المصادقة.
- `/admin`: يتطلب جلسة مستخدم وصلاحية `view_dashboard`؛ العميل لا يصبح موظفًا بمجرد التسجيل.
- `/requests/purchase?motorcycle_id=...`: يتطلب تسجيل الدخول؛ إنشاء استفسار عن دراجة معروضة لا يحجزها ولا يلزم بالشراء.
- `/requests/import`: يتطلب تسجيل الدخول؛ طلب مواصفات مع نطاقات اختيارية.
- `/requests`: يعرض طلبات المستخدم الحالي؛ الموظفون ذوو `manage_requests` يمكنهم قراءة الطلبات وتغيير حالتها عبر قاعدة البيانات، لكن واجهة إدارة الطلبات ستأتي لاحقًا.

التسجيل وإنشاء الحساب وتسجيل الخروج واستعادة كلمة المرور وتعيين كلمة جديدة تعمل عبر إجراءات خادمية؛ رسالة نجاح الاستعادة لا تكشف وجود الحساب. تحديث الكوكيز يتم في middleware ومساعد Supabase على الخادم. middleware ليس حدًا أمنيًا: بيانات كل عملية لاحقة يجب أن تمر عبر سياسات RLS أو تحقق خادمي مناسب. دور وصلاحيات الواجهة ليست بديلًا عن حماية قاعدة البيانات. ضبط Auth في Supabase يشمل السماح بعناوين `/auth/callback` محليًا وعلى نطاق النشر وإعداد البريد.

تتضمن البذرة أدوار `customer`, `employee`, `manager`, `owner`, `admin`, `sales_employee`, `inventory_employee`, `cashier` وصلاحيات منفصلة. أدوار الموظفين تبدأ بمجموعات محدودة. مخطط RBAC قابل للإضافة، لكن واجهة إدارة الأدوار وتغيير الصلاحيات ستأتي في مرحلة إدارة المستخدمين؛ لا تمنح الموظفين صلاحيات via UI الآن.

## هيكل المشروع

```text
app/
  actions/{auth,requests}.ts
  admin/page.tsx
  auth/{callback,login,signup,forgot-password,reset-password}/
  catalog/{page,[id]/page}.tsx
  requests/{page,purchase/page,import/page}.tsx
  globals.css
  layout.tsx
  page.tsx
components/auth-form.tsx
lib/
  auth/permissions.ts
  supabase/{client,server,env}.ts
middleware.ts
supabase/migrations/20261118180000_foundation.sql
supabase/migrations/20261118190000_customer_requests.sql (pending; not applied live)
docs/implementation-plan.md
tests/{validation,auth-redirect,requests-validation}.test.ts
```

## الاختبار والبناء

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

اختبارات التطبيق لا تثبت سياسات RLS في قاعدة حية. أضف اختبارات SQL/تكامل RLS وبيع مزدوج قبل إطلاق عمليات البيع. لا يوجد نشر تلقائي مكوّن هنا.

## الوسائط وOCR والتكاملات المستقبلية

`motorcycle_media.provider` وحقول المعرّف محايدة للمزود، لكنها بيانات وصفية فقط حتى بناء `StorageProvider`. لا يوجد ربط Telegram أو Bot أو تخزين وسائط فعلية في المرحلة الحالية. سيضاف `PlaceholderStorageProvider` ثم أي مزود لاحقًا خلف interface مستقلة عند بدء المرحلة الخاصة به. OCR ليس جزءًا من الأساس الحالي؛ عند تنفيذه يُستخدم `OCRService` وموفر محلي، مع الاحتفاظ بالقيمة الأصلية والمنظّمة منفصلتين.

## ما يلي

المتبقي: مزامنة سجل migration يدويًا دون إعادة تشغيل SQL التأسيسي، مراجعة/تطبيق migration الطلبات، ثم اختبارات Auth/RLS الحية وتعيين Owner الأول بعد تحديد مستخدمه، وواجهة إدارة الطلبات والمخزون والوسائط، وPOS والفواتير والمدفوعات، والتقارير وOCR والتخزين القابل للاستبدال. لا تنتقل العملية تلقائيًا إلى المرحلة التالية دون اختبار المرحلة الحالية.
