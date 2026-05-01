# My Profile — Web App

## نظرة عامة على المشروع
- **الاسم**: webapp (My Profile)
- **الهدف**: صفحة بروفايل شخصية قابلة للتعديل من المالك فقط مع إمكانية نشر تغريدات/صور/فيديوهات وعدّاد زوّار.
- **المميزات**: تعديل الاسم/المعرّف/الترحيب/الصورة/الخلفية، تفعيل روابط شبكات اجتماعية، نشر تغريدات نصية + وسائط، حذف منشورات، عدّاد زوّار فريد لكل متصفح، نظام ملكية محمي بمفتاح خاص.

## URLs
- **التطوير المحلي**: http://localhost:3000
- **الإنتاج**: (يتم تحديده بعد النشر إلى Cloudflare Pages)

## ما تم إصلاحه

### المشكلة الأصلية
- ظهور `Save failed` عند حفظ تعديلات البروفايل.
- ظهور `Post failed` عند نشر تغريدة/منشور.

### السبب الجذري
الواجهة الأمامية كانت تستدعي مسارات API على شكل `tables/profile_data`, `tables/posts`, `tables/visit_counter` لكن **لا يوجد سيرفر** يردّ عليها (الكود مُعدّ سابقاً ليعمل مع GenSpark Tables المُلغاة)، فكانت كل عمليات `POST/PUT/DELETE` تفشل.

### الحل المُطبَّق
1. بناء **واجهة خلفية Hono** على Cloudflare Pages تُحاكي نفس شكل الـ API الأصلي.
2. التخزين الدائم عبر **Cloudflare KV** (binding اسمه `KV`).
3. **التحقق من الملكية** على السيرفر:
   - أول زائر يحفظ بروفايل → يصبح المالك ويُحفظ `ownerHash` في `meta:owner_hash`.
   - أي تعديل لاحق يجب أن يحمل `ownerHash` المطابق أو `_ownerKey` يُولّد نفس الهاش، وإلا يُرفض بـ 401.
4. الواجهة الأمامية لم تتغيّر إطلاقاً — تعمل كما هي.
5. تعديل `_routes.json` ليُقدِّم Cloudflare Pages الملفات الثابتة (`/`, `/index.html`, `/static/*`) ويُمرِّر فقط `/tables/*` و`/api/*` إلى Worker.

## نقاط الـ API الفعّالة

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/tables/profile_data/:id` | جلب البروفايل (عادة `id=main`) |
| POST | `/tables/profile_data` | إنشاء بروفايل (أول مرة فقط — يُسجِّل المالك) |
| PUT | `/tables/profile_data/:id` | تعديل البروفايل (يتطلب صلاحية المالك) |
| DELETE | `/tables/profile_data/:id` | حذف البروفايل (يتطلب صلاحية المالك) |
| GET | `/tables/posts?limit=200&sort=timestamp` | جلب قائمة المنشورات |
| GET | `/tables/posts/:id` | جلب منشور واحد |
| POST | `/tables/posts` | نشر منشور جديد (يتطلب صلاحية المالك) |
| DELETE | `/tables/posts/:id` | حذف منشور (يتطلب صلاحية المالك) |
| GET | `/tables/visit_counter` | جلب عدد الزوّار |
| POST | `/tables/visit_counter` | تسجيل زيارة جديدة فريدة لكل متصفح |
| GET | `/api/health` | فحص حالة الخادم |

## المعمارية وقاعدة البيانات
- **التخزين**: Cloudflare KV (binding: `KV`)
- **مفاتيح KV**:
  - `profile:<id>` — صف البروفايل JSON
  - `posts:index` — مصفوفة معرّفات المنشورات (الأحدث أولاً)
  - `posts:item:<id>` — صف المنشور JSON
  - `visits:item:<sessionId>` — تسجيل زيارة فريدة
  - `visits:count` — العدد الكلي للزوّار
  - `meta:owner_hash` — هاش المالك المُسجَّل أول مرة (دفاع عميق)

## نموذج المصادقة
- المالك يحصل على مفتاح سرّي عشوائي (~32 بايت) يُحفظ في `localStorage` تحت `profile_owner_key`.
- الهاش (`SHA-256`) للمفتاح يُحفظ على السيرفر في `meta:owner_hash` عند أول إنشاء.
- كل طلب تعديل/حذف يتضمّن `ownerHash` (أو `_ownerKey`) ويتم التحقق منه على السيرفر.
- لمشاركة الملكية بين أجهزة → فتح الرابط `?owner=KEY` يقوم بحفظ المفتاح في الجهاز الجديد.

## دليل المستخدم
1. أول زيارة للموقع → يصبح الزائر المالك تلقائياً ويحصل على رابط خاص (`?owner=...`).
2. اضغط على أيقونة الترس ⚙️ لتعديل الاسم/المعرّف/الترحيب/الخلفية وتفعيل الشبكات الاجتماعية.
3. اضغط زر `+` أعلى قسم Posts لنشر تغريدة (نصّ و/أو صورة/فيديو حتى 6 ميجابايت).
4. اضغط على الأفاتار لرفع صورة شخصية (يتم ضغطها تلقائياً).
5. لتعديل البروفايل من جهاز آخر — احفظ رابط `?owner=...` المعروض عند أول إنشاء.

## النشر (Deployment)
- **المنصة**: Cloudflare Pages
- **المسار البنائي**: `dist/` (يحتوي `_worker.js` + `index.html` + `_routes.json`)
- **الحزمة التقنية**: Hono + TypeScript + Cloudflare KV + Vanilla JS/CSS
- **الحالة**: ✅ يعمل محلياً عبر `wrangler pages dev`

### للنشر على الإنتاج
```bash
# إعداد API key (مرة واحدة)
# ثم:
npm run build
npx wrangler kv:namespace create webapp_kv     # إنشاء KV ناميسبيس حقيقي
# تحديث wrangler.jsonc بالـ id المُرجع
npx wrangler pages deploy dist --project-name webapp
```

## التشغيل المحلي
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
```

## الميزات غير المُنفَّذة بعد
- نشر للإنتاج على Cloudflare Pages مع KV حقيقي (يحتاج API key من المستخدم).
- ربط نطاق مخصص (custom domain).
- نسخة احتياطية تلقائية للبيانات.

## الخطوات التالية المُقترحة
1. ضبط Cloudflare API key لنشر التطبيق على نطاق `pages.dev`.
2. إنشاء KV ناميسبيس حقيقي عبر `wrangler kv:namespace create`.
3. (اختياري) إضافة rate limiting عبر Cloudflare Turnstile لزرّ النشر.

## آخر تحديث
2026-05-01 — إصلاح Save failed و Post failed عبر بناء واجهة Hono خلفية.
