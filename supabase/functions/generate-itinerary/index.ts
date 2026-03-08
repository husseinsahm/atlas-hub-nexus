import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { bookingId, title, totalDays, arrivalDate, departureDate, adults, children, existingDays, singleDay } = await req.json();

    const existingContext = existingDays?.length
      ? `\nExisting days to enhance:\n${existingDays.map((d: any) => `- Day ${d.day_number}: "${d.title || ""}" in ${d.city || "unknown city"} on ${d.date || "no date"}`).join("\n")}`
      : "";

    const prompt = `You are a professional travel planner AI for a travel agency operating system. Generate or enhance itinerary day details for a trip, including suggested services for each day.

Trip Info:
- Title: ${title || "Trip"}
- Total days: ${totalDays}
- Arrival: ${arrivalDate || "unknown"}
- Departure: ${departureDate || "unknown"}
- Travelers: ${adults || 1} adults${children ? `, ${children} children` : ""}
${existingContext}

For each day (1 through ${totalDays}), provide:
- day_number (integer)
- title (short, catchy day title like "Pyramids & Ancient Wonders" or "Nile Cruise Departure")
- short_description (1-2 sentence overview of the day)
- city (main city/destination for the day)
- pickup_location (hotel name or meeting point, if applicable)
- dropoff_location (end-of-day location, if applicable)
- pickup_time (e.g. "08:00", if applicable)
- services: an array of suggested services/items for the day. Each service should have:
  - category: one of "hotel", "transfer", "activity", "guide", "meal"
  - title: descriptive service name (e.g. "Accommodation in Marriott Mena House 5★", "Private airport transfer to hotel", "🇬🇧 English-speaking tour guide", "Guided tour of Karnak Temple", "Lunch at local restaurant")
  - notes: optional brief note about the service

IMPORTANT service guidelines:
- For hotels: suggest specific hotel names with star rating when possible (e.g. "Accommodation in Hilton Luxor 5★")
- For transfers: be specific about route (e.g. "Private transfer from Cairo Airport to hotel", "Private transfer from hotel to Giza Pyramids")
- For guides: include a flag emoji and language (e.g. "🇬🇧 English-speaking tour guide", "🇩🇪 German-speaking tour guide")
- For activities: name the specific attraction or experience (e.g. "Guided tour of Valley of the Kings", "Felucca ride on the Nile")
- For meals: specify type and context (e.g. "Lunch at local Egyptian restaurant", "Dinner cruise on the Nile")
- Each day should typically have: 1 hotel, 1-2 transfers, 1 guide, 1-3 activities, and optionally 1-2 meals
- First day should include arrival transfer, last day should include departure transfer

Keep titles engaging and professional. Descriptions should help agents quickly understand the day plan.
If existing days have cities, keep those cities and enhance the content around them.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a travel itinerary planning assistant. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_itinerary_days",
              description: "Generate structured itinerary day data with services",
              parameters: {
                type: "object",
                properties: {
                  days: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day_number: { type: "integer" },
                        title: { type: "string" },
                        short_description: { type: "string" },
                        city: { type: "string" },
                        pickup_location: { type: "string" },
                        dropoff_location: { type: "string" },
                        pickup_time: { type: "string" },
                        services: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              category: { type: "string", enum: ["hotel", "transfer", "activity", "guide", "meal"] },
                              title: { type: "string" },
                              notes: { type: "string" },
                            },
                            required: ["category", "title"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["day_number", "title", "short_description", "city", "services"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["days"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_itinerary_days" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-itinerary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
