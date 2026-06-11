import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps connector not configured");
    }

    const { queries } = await req.json() as { queries: { id: string; address: string }[] };
    if (!Array.isArray(queries)) throw new Error("queries must be an array");

    const results = await Promise.all(
      queries.map(async (q) => {
        if (!q.address?.trim()) return { id: q.id, lat: null, lng: null };
        try {
          const r = await fetch(
            `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(q.address)}`,
            {
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
              },
            }
          );
          const d = await r.json();
          const loc = d?.results?.[0]?.geometry?.location;
          return {
            id: q.id,
            lat: loc?.lat ?? null,
            lng: loc?.lng ?? null,
            formatted: d?.results?.[0]?.formatted_address ?? null,
          };
        } catch {
          return { id: q.id, lat: null, lng: null };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
