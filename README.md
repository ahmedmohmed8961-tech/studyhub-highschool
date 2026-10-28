# StudyHub — منصة تعليمية للثانوية العامة

مشروع بداية (MVP) عربي باتجاه RTL، يضم:
- إنشاء حساب طالب وتسجيل الدخول.
- تخزين كلمات المرور باستخدام bcrypt.
- جلسات JWT.
- كورسات ودروس فيديو من YouTube/Vimeo.
- تفعيل كود اشتراك لمرة واحدة وربطه بكورس.
- واجهات API للمسؤول لإنشاء الكورسات والأكواد.
- تصميم متجاوب للموبايل والكمبيوتر.

> هذه نسخة أولية قابلة للتطوير، وليست جاهزة لاستقبال مدفوعات حقيقية أو استضافة فيديوهات محمية بشكل احترافي دون إعدادات إضافية.

## المتطلبات
- Node.js 20 أو أحدث.
- حساب MongoDB Atlas وقاعدة بيانات.
- Git وGitHub (اختياريان للتشغيل المحلي، مطلوبان إذا أردت النشر من GitHub).

## 1) إعداد قاعدة البيانات
1. أنشئ Cluster مجانيًا في MongoDB Atlas.
2. أنشئ Database User بكلمة مرور قوية.
3. من Network Access اسمح بعنوان IP الخاص بك للتجربة. عند النشر، اضبط الوصول حسب تعليمات مزود الاستضافة؛ تجنب فتح قاعدة البيانات للعالم دون داعٍ.
4. انسخ connection string من Atlas، واستبدل اسم المستخدم وكلمة المرور واسم قاعدة البيانات.

## 2) تشغيل المشروع على جهازك
افتح Terminal داخل مجلد المشروع، ثم:
```bash
npm install
```
انسخ `.env.example` إلى ملف جديد اسمه `.env`، ثم املأ القيم:
```env
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=ضع-هنا-سراً-عشوائياً-طويلاً
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ضع-كلمة-مرور-فريدة-طويلة-لا-تقل-عن-12-حرفاً
```
لا ترفع ملف `.env` إلى GitHub أبدًا. `.gitignore` معدّ لتجاهله.
شغّل:
```bash
npm start
```
ثم افتح `http://localhost:3000`.

## 3) رفع المشروع على GitHub
1. أنشئ Repository جديدًا على GitHub.
2. ارفع ملفات المشروع كلها **ما عدا `.env` و`node_modules`**.
3. لا ترفع كلمات مرور أو أكواد سرية أو بيانات طلاب حقيقية.
4. GitHub Pages وحده لا يشغّل هذا النوع من الـ backend؛ انشر التطبيق كخدمة Node.js.

باستخدام Git:
```bash
git init
git add .
git commit -m "Initial StudyHub platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

## 4) نشر التطبيق
يمكنك استخدام Render أو خدمة Node.js مشابهة:
1. أنشئ Web Service واربطها بمستودع GitHub.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. أضف Environment Variables من إعدادات الاستضافة:
   - `MONGODB_URI`
   - `JWT_SECRET` (سري طويل وعشوائي)
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (كلمة مرور فريدة بطول 12 حرفًا أو أكثر)
5. لا تضع الأسرار داخل ملفات الكود.
6. اختبر رابط `/api/health` بعد النشر.

## 5) إنشاء أول كورس وأكواد الاشتراك
1. سجّل دخولًا بحساب المسؤول الذي أنشأه السيرفر من `ADMIN_EMAIL` و`ADMIN_PASSWORD`.
2. من لوحة المسؤول اضغط «عرض الكورسات» إن كان هناك كورسات. إذا لم يوجد كورس، استخدم API لإنشاء أول كورس.
3. أنشئ كورسًا عبر `POST /api/admin/courses` مع ترويسة `Authorization: Bearer YOUR_ADMIN_TOKEN` وجسم JSON مثل:
```json
{
  "title": "مراجعة رياضيات — الوحدة الأولى",
  "subject": "الرياضيات",
  "teacher": "أ. أحمد",
  "description": "شرح ومراجعة للثانوية العامة",
  "lessons": [
    {
      "title": "المحاضرة الأولى",
      "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
      "duration": "45 دقيقة"
    }
  ]
}
```
خذ `id` للكورس من الاستجابة، ثم أنشئ أكوادًا:
`POST /api/admin/codes`
```json
{ "courseId": "COURSE_ID_HERE", "count": 10 }
```
الاستجابة تحتوي الأكواد مرة واحدة فقط. احتفظ بها في مكان آمن ووزّع كل كود لطالب واحد. لا تشارك أكوادًا حقيقية علنًا.

### الحصول على Admin Token
سجّل دخولًا إلى `POST /api/auth/login` باستخدام البريد وكلمة المرور الخاصة بالمسؤول، وخذ `token` من الاستجابة.
مثال باستخدام curl:
```bash
curl -X POST https://YOUR-APP.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YOUR_ADMIN_PASSWORD"}'
```

## API مختصر
- `POST /api/auth/register` إنشاء حساب.
- `POST /api/auth/login` تسجيل الدخول.
- `GET /api/me` بيانات الحساب والكورسات المفعّلة.
- `GET /api/courses` قائمة الكورسات المنشورة.
- `POST /api/codes/redeem` تفعيل كود (يتطلب تسجيل الدخول).
- `GET /api/courses/:id` تفاصيل الدروس (يتطلب صلاحية الكورس).
- `POST /api/admin/courses` إنشاء كورس (مسؤول فقط).
- `POST /api/admin/codes` إنشاء أكواد (مسؤول فقط).

## مهم قبل الاستخدام التجاري
- أضف حماية من محاولات تسجيل الدخول الكثيرة (rate limiting)، واستعادة كلمة المرور والتحقق من البريد.
- أضف لوحة إدارة كاملة بدل استخدام API مباشرة.
- أكواد الاشتراك في هذا النموذج لمرة واحدة؛ لكن يلزم إضافة سجل تدقيق ومعالجة معاملات ذرية لمنع أي سباق نادر عند استخدام متزامن كثيف.
- روابط YouTube العادية لا تمنع نسخ الرابط أو تسجيل الشاشة. استخدم مزود فيديو مدفوعًا يدعم التوقيع/الحماية عند الحاجة.
- لا توجد بوابة دفع في هذه النسخة. قبل تحصيل أموال، أضف بوابة دفع متوافقة مع بلدك وسياسات المزود.
- راعِ خصوصية الطلاب، وأمّن قاعدة البيانات، واحتفظ بنسخ احتياطية، واختبر النظام قبل إطلاقه.
