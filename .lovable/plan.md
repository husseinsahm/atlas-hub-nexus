# خطة المرحلة الثانية — Booking Files & Itineraries

الست بنود الأولى خلصت ✅ (Financial Summary, Quick Actions, Unified Timeline, Split View, Map View, Day Scheduling).
دلوقت ننتقل لطبقة أعمق: تسعير ذكي، تعاون لحظي، وأتمتة عمليات يومية.

## 1. Smart Pricing Engine

شريط تسعير ديناميكي أسفل الـ Itinerary Builder + modal "Pricing Studio":

```
┌─────────────────────────────────────────────────────────┐
│ Pax: [2 Adults] [1 Child]   Markup: [25% ▼]   Rounding │
│ Per-Person: $1,250  ·  Total: $3,125  ·  Margin: 28%   │
│ [Apply to Booking]  [Save as Quote]                    │
└─────────────────────────────────────────────────────────┘
```

- Per-pax pricing (adult/child/infant) مع splits تلقائية
- Markup presets (10%, 20%, 30%, custom) + rounding rules (5, 10, 50, 100)
- Group discount tiers (مثلاً ≥6 pax → -8%)
- Live comparison: cost vs selling vs margin %
- زر "Apply" يكتب على booking_services.selling_price ويحدّث الـ FinancialSummaryPanel

## 2. Live Collaboration & Presence

داخل صفحة الحجز:

- **Presence bar** أعلى الصفحة تعرض المستخدمين الحاليين (avatars + ping)
- **Realtime updates** لأي تعديل (status, items, payments) بدون refresh
- **Comment threads** على مستوى الـ day أو الـ item (مش الحجز كله بس)
- **@mentions** بتولّد notification للعضو
- Optimistic UI مع conflict resolution لو اتنين عدّلوا نفس الـ item

التنفيذ: Supabase Realtime channels على `bookings:id={id}` + broadcast للـ presence.

## 3. Booking Templates & Recipes

تحويل أي حجز ناجح لـ "Recipe" قابلة لإعادة الاستخدام:

- زر **"Save as Recipe"** في BookingQuickActions
- يستخرج: الأيام + الـ items + الـ pricing structure (بدون بيانات العميل)
- **Recipe Library** في الـ sidebar تظهر آخر recipes مستخدمة
- "New Booking from Recipe" → ينشئ حجز كامل في ثواني
- Versioning للـ recipes (v1, v2, ...) عشان التعديلات ما تكسرش الحجوزات القديمة

## 4. Automated Workflows (Triggers)

محرّك بسيط للأتمتة في settings → Automations:

```
WHEN booking status → "confirmed"
  DO: create invoice (50% deposit)
  DO: send email to client
  DO: assign CRM task "Collect deposit" to agent
```

- Triggers جاهزة: status change, payment received, X days before arrival, X days overdue
- Actions: create invoice, send email, create task, change status, notify role
- لكل شركة workflows مخصصة + 5 templates جاهزة (Confirmation flow, Pre-arrival, Post-trip feedback, ...)

## 5. Client Portal 2.0

تحسينات على البوابة الموجودة:

- **Approve / Request Changes** buttons على كل يوم (مش الحجز كله)
- **Payment portal** مدمج (إذا فيه Stripe/Paddle مفعّل) — العميل يدفع الـ deposit مباشرة
- **Document vault** — العميل يرفع الباسبور/الفيزا والوكالة تستلمها في booking_attachments
- **Trip Wallet** PWA-ready: vouchers, contacts الطوارئ, خريطة offline لكل يوم
- QR code للوكيل أو الـ guide في كل يوم

## 6. Operations Dashboard

صفحة جديدة `/dashboard/operations` للفريق التشغيلي:

- **Today's Movements** — pickups, drop-offs, check-ins, departures مرتبة بالساعة
- **Driver/Guide assignments** view مع حالة كل assignment
- **Service alerts**: حجوزات بدون transfer مؤكد، فنادق بدون رقم تأكيد، إلخ
- **Map view** لكل الحركات النهارده على Google Maps
- Filters: branch, day range, service type

## التفاصيل التقنية

**Database migrations:**
- `pricing_rules` table (company_id, markup_pct, rounding, group_tiers jsonb)
- `booking_recipes` (company_id, name, structure jsonb, version, parent_id)
- `automations` (company_id, trigger_type, trigger_config jsonb, actions jsonb[], is_active)
- `automation_runs` (audit log للأتمتة)
- إضافة `pax_breakdown jsonb` و `markup_pct numeric` للـ bookings
- Index على `service_assignments(scheduled_start)` لـ Operations Dashboard

**Realtime:**
- تفعيل Realtime على `bookings`, `booking_day_items`, `booking_activities`
- Helper hook `useBookingPresence(bookingId)` يدير الـ presence channel
- Helper `useBookingRealtime(bookingId)` يحدّث react-query cache تلقائياً

**Edge functions:**
- `run-automation` (يستقبل event ويشغل actions)
- `client-payment-intent` (لو فيه Stripe مفعّل)

**Components جديدة:**
- `src/components/booking/PricingStudio.tsx`
- `src/components/booking/PresenceBar.tsx`
- `src/components/booking/ItemCommentThread.tsx`
- `src/components/recipes/RecipeLibrary.tsx`
- `src/pages/dashboard/AutomationsPage.tsx`
- `src/pages/dashboard/OperationsPage.tsx`
- `src/components/portal/PaymentBlock.tsx`
- `src/components/portal/DocumentUpload.tsx`

## ترتيب التنفيذ المقترح

1. ✅ Smart Pricing Engine
2. ✅ Live Collaboration & Presence
3. ✅ Operations Dashboard
4. ✅ Booking Templates & Recipes
5. Automated Workflows
6. Client Portal 2.0
