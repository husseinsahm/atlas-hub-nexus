# خطة تطوير شركة السياحة (أسطول + تشغيل متقدم)

بناءً على فحص النظام الحالي: عندك Booking Files + Operations + Services + Tasks، لكن **لا يوجد إدارة أسطول (Fleet)** ولا **جدولة موارد (Dispatch)** ولا **متابعة سائقين** — وهذه أهم نقاط الضعف لشركة عندها أتوبيسات/سيارات/مراكب.

---

## 1) ما يحتاج تطوير (موجود لكن ناقص)

| الموجود | المشكلة | التحسين |
|---|---|---|
| `OperationsPage` | يعرض الخدمات كقائمة فقط | إضافة **Dispatch Board** بتقويم يومي/أسبوعي (Timeline view) لكل مركبة وسائق |
| `booking_services` | حقول مورد نصية فقط (supplier_name) | ربط فعلي بـ `vehicles` و `drivers` بدل النص الحر |
| Tasks | عامة | إضافة نوع **Operations Task** (تأكيد سائق، فحص مركبة، تسليم وقود) |
| Notifications | للموظفين فقط | إشعارات WhatsApp/SMS للسائق والعميل قبل الرحلة بـ 24 ساعة |
| تقارير | محدودة | تقرير **استغلال الأسطول** (Utilization %) لكل مركبة شهرياً |

---

## 2) ما يحتاج يُضاف (وحدات جديدة)

### أ‌. وحدة الأسطول (Fleet Management) — **الأولوية القصوى**
- جدول `vehicles`: نوع (Bus/Car/Golden Boat)، رقم لوحة، سعة ركاب، حالة (متاح/صيانة/مؤجر)، صور، أوراق (رخصة، تأمين، فحص) مع تنبيهات انتهاء.
- جدول `drivers`: بيانات السائق، رخصة القيادة وتاريخ انتهائها، التقييم، الحالة.
- جدول `vehicle_maintenance`: سجل صيانة + جدولة الصيانة الدورية بالكيلومتر/التاريخ.
- جدول `vehicle_expenses`: وقود، صيانة، غرامات → يدخل في تكلفة الرحلة.

### ب‌. وحدة الجدولة والإسناد (Dispatch & Assignment)
- جدول `service_assignments`: يربط `booking_service` بـ `vehicle_id` + `driver_id` + توقيت فعلي.
- **Dispatch Board** بصري (Gantt/Timeline) يكشف التعارضات تلقائياً (نفس المركبة في وقتين).
- Drag & drop لإسناد رحلة لسائق/مركبة.
- تنبيه لو سائق مسند لرحلتين متداخلتين.

### ج‌. بوابة السائق (Driver Portal / Mobile-friendly)
- صفحة برابط آمن (token) للسائق يشوف فيها رحلاته اليومية، يعمل Check-in/Check-out، يرفع صور (عداد الكيلومترات، إيصال وقود)، يضع توقيع العميل بعد الرحلة.

### د‌. تتبع الرحلة (Trip Execution)
- حالات تشغيلية: `scheduled → en_route → picked_up → in_progress → completed → invoiced`
- Timestamps فعلية vs مخططة → تقرير الالتزام بالمواعيد.
- حقل GPS موقع آخر (اختياري لو في تكامل مستقبلي).

### هـ. التكاملات المالية
- ربط `vehicle_expenses` و `driver_payouts` بصفحة Finance للبوكينج.
- حساب ربحية الرحلة الفعلي بعد خصم تكاليف الأسطول والسائق.

### و. تقارير تشغيلية جديدة
- استغلال كل مركبة (أيام مؤجرة / إجمالي أيام).
- أداء كل سائق (عدد رحلات، تأخير، تقييم العميل).
- تكلفة تشغيل لكل مركبة (وقود + صيانة + سائق).
- توقعات الصيانة القادمة.

---

## 3) ترتيب التنفيذ المقترح (Phases)

```text
المرحلة 1 (أساس):  Fleet + Drivers CRUD + ربطها بـ booking_services
المرحلة 2 (تشغيل): Dispatch Board + كشف التعارضات + Assignments
المرحلة 3 (سائق):  Driver Portal + Check-in/out + توقيع العميل
المرحلة 4 (صيانة): Maintenance + Documents Expiry alerts
المرحلة 5 (مالي):  Vehicle expenses + ربحية فعلية للرحلة
المرحلة 6 (تقارير): Utilization + Driver performance dashboards
```

---

## 4) تفاصيل تقنية مختصرة

- جداول جديدة في `public`: `vehicles`, `drivers`, `vehicle_documents`, `vehicle_maintenance`, `vehicle_expenses`, `service_assignments`, `driver_trip_logs`.
- كلها multi-tenant بـ `company_id` + RLS (نفس النمط الحالي).
- Dispatch Board: مكتبة `@dnd-kit` (موجودة غالباً) + تايملاين مخصص.
- Driver Portal: route عام مثل `/driver/:token` بدون تسجيل دخول كامل (نفس فكرة Shared Booking).
- إشعارات WhatsApp/SMS: عبر Edge Function + مزود خارجي (Twilio أو WhatsApp Cloud API) — يحتاج اتصال connector.

---

## سؤال قبل التنفيذ
ابدأ بأي مرحلة؟ أنصح بالبدء بـ **المرحلة 1 + 2** (الأسطول + Dispatch Board) لأنها أكبر قيمة فورية. وافق لأبدأ بهم، أو حدد أولوية مختلفة.

