
# خطة تحسين Booking Files و Itineraries

## 1. Booking File — Financial Summary Panel

بانل ثابت في أعلى صفحة الحجز يعرض الأرقام المهمة بنظرة واحدة:

```
┌─────────────────────────────────────────────────────────┐
│  Total Price    Total Cost    Profit       Paid   Due  │
│   $12,500       $8,200       $4,300 (34%) $5,000 $7,500│
│                                            [▓▓▓░░░░] 40%│
└─────────────────────────────────────────────────────────┘
```

- Total Price = مجموع الـ booking_services.selling_price
- Total Cost = مجموع cost_price
- Profit = الفرق + هامش %
- Paid = مجموع payment_records
- Due = price - paid مع progress bar وlozenge ملوّن (أحمر لو متأخر، أصفر لو جزئي، أخضر لو متكامل)
- العملة من company_settings

## 2. Booking File — Quick Actions Toolbar

شريط أزرار في الـ header بدل ما الـ actions متفرقة:

- **Send to Client** → ينشئ share token و ينسخ الرابط
- **Generate Invoice** → ينشئ فاتورة بالأرقام الجاهزة
- **Add Payment** → modal دفعة جديدة
- **Duplicate Booking** → نسخة كاملة بـ status=draft
- **Print/PDF** → PDF كامل للحجز
- **More** dropdown: Cancel / Archive / Export

## 3. Booking File — Unified Timeline Tab

Tab جديد "Activity" يدمج كل الأحداث في خط زمني واحد:

- Activities (status changes, assignments)
- Internal comments
- Payment records  
- Driver trip logs (check-in/out)
- File attachments المضافة
- Email/share events

كل event بـ icon + لون + timestamp نسبي + actor. فلتر بنوع الحدث.

## 4. Itinerary — Split View Preview

في TripBuilderPage و ItineraryBuilder، شاشة مقسومة:

```
┌────────────────┬────────────────┐
│  Builder       │  Live Preview  │
│  (edit days)   │  (client view) │
│                │                │
│  Day 1 ▼       │  [Hero image]  │
│   + Service    │  Day 1: Cairo  │
│   + Service    │   Pyramids tour│
│  Day 2 ▼       │   ...          │
└────────────────┴────────────────┘
  Cost: $4,200 │ Selling: $6,500 (real-time)
```

- Toggle لإخفاء/إظهار الـ preview
- Cost roll-up bar ثابتة أسفل الشاشة تتحدث فوراً مع كل تغيير
- Preview بنفس شكل client portal

## 5. Itinerary — Day Scheduling

تحسين trip_day_items و booking_day_items:

- حقل `start_time` و `duration_minutes` لكل item
- عرض اليوم كـ timeline عمودي بالساعات (8:00 AM → 10:00 PM)
- Drag للـ items داخل اليوم يحدّث الوقت تلقائياً
- Conflict detection (تداخل أوقات)
- Auto-calculate يوم end time من آخر activity

## 6. Itinerary — Map View

استخدام Google Maps connector (متاح) لعرض:

- خريطة لكل يوم تعرض stops بالترتيب مع خطوط بينها
- Geocoding للـ locations عبر الـ gateway
- Distance/duration بين stops (Routes API)
- زر "View on Map" في كل day item

## التفاصيل التقنية

**Database migrations:**
- إضافة `start_time TIME, duration_minutes INT, latitude NUMERIC, longitude NUMERIC` إلى `trip_day_items` و `booking_day_items`
- إضافة `location_address TEXT, place_id TEXT` للـ items
- View: `booking_financial_summary` تجمّع الأرقام (price, cost, paid, due) في query واحد

**Components جديدة:**
- `src/components/booking/FinancialSummaryPanel.tsx`
- `src/components/booking/BookingQuickActions.tsx`  
- `src/components/booking/UnifiedTimeline.tsx`
- `src/components/itinerary/SplitViewBuilder.tsx`
- `src/components/itinerary/DayTimeline.tsx`
- `src/components/itinerary/ItineraryMapView.tsx`

**Connectors المطلوبة:**
- Google Maps Platform (للـ geocoding + map rendering + routes)

**Files كبيرة سيتم تعديلها:**
- `BookingDetailPage.tsx` (2080 سطر) — إضافة Financial Panel + Quick Actions + Timeline tab
- `TripBuilderPage.tsx` (2043 سطر) — Split view + day timeline + map toggle
- `ItineraryBuilder.tsx` (1377 سطر) — start_time fields في items

## ترتيب التنفيذ المقترح

1. Financial Summary + Quick Actions (الأسرع والأعلى قيمة)
2. Unified Timeline (يعتمد على بيانات موجودة)
3. Day scheduling (migration + UI)
4. Split View Preview
5. Map View (يحتاج Google Maps connector)

ممكن نبدأ بالأول والتاني في batch واحد لأنهم frontend بحت بدون migrations.
