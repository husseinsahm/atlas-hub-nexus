import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ItineraryMapViewProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itineraryDays: any[];
  isArabic: boolean;
}

declare global {
  interface Window {
    google?: any;
    __lovableInitMap?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const existing = document.getElementById("google-maps-js");
    if (existing) {
      const interval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(interval); reject(new Error("Maps load timeout")); }, 10000);
      return;
    }
    window.__lovableInitMap = () => resolve();
    const s = document.createElement("script");
    s.id = "google-maps-js";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__lovableInitMap&channel=${TRACKING_ID}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

export function ItineraryMapView({ open, onOpenChange, itineraryDays, isArabic }: ItineraryMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<{ id: string; label: string; lat: number; lng: number; day: number }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const queries = itineraryDays
          .filter((d: any) => d.city || d.pickup_location)
          .map((d: any) => ({ id: d.id, address: d.city || d.pickup_location, day: d.day_number, label: d.title || `Day ${d.day_number}` }));
        if (queries.length === 0) {
          setPins([]);
          setLoading(false);
          return;
        }

        const { data, error: fnErr } = await supabase.functions.invoke("geocode-itinerary", {
          body: { queries: queries.map(q => ({ id: q.id, address: q.address })) },
        });
        if (fnErr) throw fnErr;
        if (cancelled) return;

        const located = (data?.results || [])
          .map((r: any) => {
            const q = queries.find(x => x.id === r.id);
            return r.lat && r.lng && q ? { id: r.id, lat: r.lat, lng: r.lng, label: q.label, day: q.day } : null;
          })
          .filter(Boolean) as any[];
        setPins(located);

        await loadGoogleMaps();
        if (cancelled || !mapRef.current || located.length === 0) {
          setLoading(false);
          return;
        }

        const bounds = new window.google.maps.LatLngBounds();
        located.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));

        const map = new window.google.maps.Map(mapRef.current, {
          center: bounds.getCenter(),
          zoom: 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Markers + polyline connecting days in order
        const path: { lat: number; lng: number }[] = [];
        located.sort((a, b) => a.day - b.day).forEach((p) => {
          new window.google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            label: { text: String(p.day), color: "#fff", fontWeight: "bold", fontSize: "12px" },
            title: p.label,
          });
          path.push({ lat: p.lat, lng: p.lng });
        });

        if (path.length > 1) {
          new window.google.maps.Polyline({
            path,
            map,
            strokeColor: "#C4704B",
            strokeOpacity: 0.8,
            strokeWeight: 2.5,
            geodesic: true,
          });
        }

        map.fitBounds(bounds, 60);
        if (located.length === 1) map.setZoom(11);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load map");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, itineraryDays]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 py-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4 text-accent" />
            {isArabic ? "خريطة المسار" : "Itinerary Map"}
            <Badge variant="outline" className="ms-2 text-[10px]">
              {pins.length} {isArabic ? "موقع" : "stops"}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="relative flex-1 min-h-[500px] bg-muted/20">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/60">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && pins.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <MapPin className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {isArabic ? "أضف مدن أو مواقع للأيام لعرضها على الخريطة" : "Add cities or pickup locations to days to see them on the map"}
              </p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
