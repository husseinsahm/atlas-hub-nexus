import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, Hotel, Car, User, Activity, FileText, Eye } from "lucide-react";
import { format } from "date-fns";

interface SplitViewPreviewProps {
  booking: any;
  itineraryDays: any[];
  isArabic: boolean;
}

const catIcon = (c: string) => ({ hotel: Hotel, transfer: Car, guide: User, activity: Activity }[c] || FileText);

export function SplitViewPreview({ booking, itineraryDays, isArabic }: SplitViewPreviewProps) {
  const currency = booking?.currency || "USD";
  const totals = itineraryDays.reduce(
    (acc, d) => {
      const items = d.booking_day_items || [];
      const sum = items.reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);
      acc.total += sum;
      acc.items += items.length;
      return acc;
    },
    { total: 0, items: 0 }
  );

  return (
    <div className="sticky top-4 h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/20 shadow-sm">
      {/* Preview header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isArabic ? "معاينة العميل" : "Client Preview"}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {totals.total.toLocaleString()} {currency}
        </Badge>
      </div>

      {/* Hero */}
      <div className="px-5 py-4 border-b border-border/60">
        <h2 className="text-xl font-bold font-display text-foreground">
          {booking?.title || (isArabic ? "رحلتك المخصصة" : "Your Custom Trip")}
        </h2>
        {booking?.destination && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {booking.destination}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span>{itineraryDays.length} {isArabic ? "أيام" : "days"}</span>
          <span>·</span>
          <span>{totals.items} {isArabic ? "نشاط" : "activities"}</span>
        </div>
      </div>

      {/* Days */}
      <div className="px-5 py-4 space-y-4">
        {itineraryDays.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {isArabic ? "لا توجد أيام بعد" : "No days added yet"}
          </p>
        )}
        {itineraryDays.map((day) => {
          const items = (day.booking_day_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
          const dayTotal = items.reduce((s: number, i: any) => s + Number(i.total_price || 0), 0);
          return (
            <div key={day.id} className="rounded-xl border border-border/40 bg-card overflow-hidden">
              <div className="bg-gradient-to-r from-accent/10 to-transparent px-3 py-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {day.day_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{day.title || `${isArabic ? "يوم" : "Day"} ${day.day_number}`}</div>
                  {day.date && (
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(day.date), "EEE, MMM d")}
                    </div>
                  )}
                </div>
                {day.city && (
                  <Badge variant="outline" className="text-[9px] gap-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {day.city.split(",")[0]}
                  </Badge>
                )}
              </div>
              {day.short_description && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border/40">
                  {day.short_description}
                </p>
              )}
              {items.length > 0 && (
                <div className="divide-y divide-border/40">
                  {items.map((item: any) => {
                    const Icon = catIcon(item.category);
                    return (
                      <div key={item.id} className="px-3 py-2 flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-foreground truncate">
                            {item.custom_title || item.category}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            {item.start_time && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {item.start_time}
                              </span>
                            )}
                            {item.duration_minutes && (
                              <span>{item.duration_minutes} {isArabic ? "د" : "min"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {dayTotal > 0 && (
                <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-mono font-semibold text-right">
                  {dayTotal.toLocaleString()} {currency}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Totals footer */}
      <div className="px-5 py-4 bg-muted/20">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">
            {isArabic ? "الإجمالي" : "Grand Total"}
          </span>
          <span className="text-base font-bold font-mono text-accent">
            {totals.total.toLocaleString()} {currency}
          </span>
        </div>
      </div>
    </div>
  );
}
