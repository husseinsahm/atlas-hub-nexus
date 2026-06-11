import { useRef, useState, useMemo } from "react";
import { Hotel, Car, User, Activity, FileText, Clock, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_HEIGHT = 56; // px per hour
const SNAP_MINUTES = 15;

const ICONS: Record<string, any> = { hotel: Hotel, transfer: Car, guide: User, activity: Activity };
const COLORS: Record<string, string> = {
  hotel: "bg-blue-100/80 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  transfer: "bg-amber-100/80 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  guide: "bg-purple-100/80 border-purple-300 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  activity: "bg-emerald-100/80 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Props {
  items: any[];
  isArabic: boolean;
  onUpdateItem: (id: string, updates: Record<string, any>) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

export function DayTimeline({ items, isArabic, onUpdateItem, onEditItem, onDeleteItem }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const totalMinutes = (END_HOUR - START_HOUR + 1) * 60;
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  const { positioned, unscheduled } = useMemo(() => {
    const positioned: any[] = [];
    const unscheduled: any[] = [];
    for (const it of items) {
      const start = toMinutes(it.start_time);
      const dur = Math.max(15, Number(it.duration_minutes) || 60);
      if (start == null) { unscheduled.push(it); continue; }
      positioned.push({ ...it, _start: start, _dur: dur });
    }
    // conflict detection
    positioned.sort((a, b) => a._start - b._start);
    for (let i = 0; i < positioned.length; i++) {
      const a = positioned[i];
      a._conflict = false;
      for (let j = 0; j < positioned.length; j++) {
        if (i === j) continue;
        const b = positioned[j];
        if (a._start < b._start + b._dur && b._start < a._start + a._dur) {
          a._conflict = true;
          break;
        }
      }
    }
    return { positioned, unscheduled };
  }, [items]);

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = dragging || e.dataTransfer.getData("text/plain");
    if (!id || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = (y / totalHeight) * totalMinutes;
    const snapped = Math.round(minutesFromStart / SNAP_MINUTES) * SNAP_MINUTES;
    const absolute = Math.max(0, Math.min(totalMinutes - SNAP_MINUTES, snapped)) + START_HOUR * 60;
    onUpdateItem(id, { start_time: fmt(absolute) });
    setDragging(null);
  };

  return (
    <div className="space-y-3">
      <div
        ref={gridRef}
        className="relative rounded-xl border border-border bg-muted/10 overflow-hidden"
        style={{ height: totalHeight }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={handleDrop}
      >
        {/* Hour grid */}
        {hours.map((h, idx) => (
          <div
            key={h}
            className="absolute start-0 end-0 border-t border-border/40 first:border-t-0"
            style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          >
            <span className="absolute start-1.5 top-0.5 text-[9px] font-mono text-muted-foreground tabular-nums">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}

        {/* Items */}
        {positioned.map((it) => {
          const Icon = ICONS[it.category] || FileText;
          const top = ((it._start - START_HOUR * 60) / totalMinutes) * totalHeight;
          const height = Math.max(28, (it._dur / totalMinutes) * totalHeight);
          const visibleHeight = Math.min(height, totalHeight - top);
          if (top >= totalHeight || visibleHeight <= 0) return null;
          return (
            <div
              key={it.id}
              draggable
              onDragStart={(e) => handleDragStart(e, it.id)}
              className={cn(
                "absolute start-12 end-2 rounded-lg border ps-2 pe-1 py-1 text-[11px] cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group overflow-hidden",
                COLORS[it.category] || "bg-muted border-border text-foreground",
                it._conflict && "ring-2 ring-destructive/60",
                dragging === it.id && "opacity-50",
              )}
              style={{ top, height: visibleHeight }}
              title={it.custom_title}
            >
              <div className="flex items-start gap-1.5 h-full">
                <Icon className="w-3 h-3 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold truncate">{it.custom_title || it.category}</span>
                    {it._conflict && (
                      <Badge variant="destructive" className="text-[8px] h-3.5 px-1 gap-0.5">
                        <AlertTriangle className="w-2 h-2" />
                        {isArabic ? "تعارض" : "Conflict"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[9px] opacity-75 font-mono tabular-nums">
                    {fmt(it._start)} → {fmt(Math.min(END_HOUR * 60 + 59, it._start + it._dur))} · {it._dur}m
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); onEditItem(it.id); }}>
                    <Pencil className="w-2.5 h-2.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-4 w-4 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteItem(it.id); }}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled drop zone */}
      {unscheduled.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-2.5 bg-muted/20">
          <p className="text-[10px] uppercase font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isArabic ? "بدون وقت محدد — اسحب لجدولتها" : "Unscheduled — drag onto timeline to schedule"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((it) => {
              const Icon = ICONS[it.category] || FileText;
              return (
                <div
                  key={it.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, it.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] cursor-grab active:cursor-grabbing",
                    COLORS[it.category] || "bg-muted border-border text-foreground",
                    dragging === it.id && "opacity-50",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span className="font-medium truncate max-w-[180px]">{it.custom_title || it.category}</span>
                  <span className="text-[9px] opacity-70">{Number(it.duration_minutes) || 60}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
