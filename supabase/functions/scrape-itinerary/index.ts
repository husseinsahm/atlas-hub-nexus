const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, language } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch the webpage
    console.log("Fetching URL:", url);
    const pageResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TravelCRM/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!pageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${pageResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await pageResponse.text();

    // Extract image URLs from the HTML before stripping tags
    const imageUrls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      let src = imgMatch[1];
      // Skip tiny icons, trackers, base64
      if (src.startsWith("data:")) continue;
      if (src.includes("pixel") || src.includes("tracker") || src.includes("favicon")) continue;
      if (src.includes(".svg") || src.includes("1x1")) continue;
      // Resolve relative URLs
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try {
          const u = new URL(url);
          src = u.origin + src;
        } catch { continue; }
      }
      // Only keep likely gallery/content images
      if (src.match(/\.(jpg|jpeg|png|webp)/i)) {
        imageUrls.push(src);
      }
    }

    // Also extract from og:image and meta tags
    const ogRegex = /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
    let ogMatch;
    while ((ogMatch = ogRegex.exec(html)) !== null) {
      imageUrls.push(ogMatch[1]);
    }

    // Deduplicate
    const uniqueImages = [...new Set(imageUrls)];

    // Strip scripts/styles, keep text
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 20000); // slightly larger limit for more context

    // Step 2: Use AI to extract structured itinerary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isArabic = language === "ar";

    const systemPrompt = `You are an expert travel itinerary extractor. Given webpage text content, extract the travel itinerary into a structured JSON format.

Return ONLY valid JSON with this exact structure:
{
  "title": "Trip title/name",
  "description": "Brief trip description",
  "total_days": <number>,
  "destinations": ["City 1", "City 2"],
  "trip_type": "type of trip (Family, Adventure, Cultural, Cruise, etc.)",
  "options": [
    {
      "title": "Option name e.g. 3 Nights From Aswan to Esna",
      "duration_nights": 3,
      "departure_from": "Aswan",
      "description": "Brief description of this option"
    }
  ],
  "inclusions": ["Included item 1", "Included item 2"],
  "exclusions": ["Excluded item 1", "Excluded item 2"],
  "availability": [
    {
      "day_of_week": "Monday",
      "departure_from": "Esna",
      "notes": "optional note"
    }
  ],
  "days": [
    {
      "day_number": 1,
      "title": "Day title",
      "description": "Day overview",
      "city": "City name",
      "items": [
        {
          "category": "activity|hotel|transport|meal|flight|cruise",
          "title": "Item title",
          "description": "Brief description"
        }
      ]
    }
  ]
}

Rules:
- Extract ALL days mentioned in the itinerary
- Categorize items correctly: meals → "meal", transport/transfers → "transport", sightseeing/visits → "activity", hotels/accommodation → "hotel", cruises/sailing → "cruise"
- If a city is mentioned for a day, include it
- Extract "options" if the page offers multiple variants (e.g. different durations, different departure points). If there's only one option, return empty array [].
- Extract "inclusions" (what's included in the price) and "exclusions" (what's not included). Return empty arrays if not found.
- Extract "availability" schedule if mentioned (departure days). Return empty array if not found.
- Return titles ${isArabic ? "in Arabic" : "in the original language of the content, or English if unclear"}
- If you cannot find itinerary data, return {"error": "No itinerary found in this page"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract the itinerary from this webpage content:\n\n${textContent}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (handle markdown code blocks)
    let itinerary;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      itinerary = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse itinerary from page" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (itinerary.error) {
      return new Response(
        JSON.stringify({ error: itinerary.error }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attach gallery images found in HTML
    itinerary.gallery_images = uniqueImages.slice(0, 30); // cap at 30

    console.log("Extracted itinerary:", itinerary.title, "-", itinerary.total_days, "days",
      "options:", itinerary.options?.length || 0,
      "inclusions:", itinerary.inclusions?.length || 0,
      "exclusions:", itinerary.exclusions?.length || 0,
      "gallery:", itinerary.gallery_images?.length || 0,
    );

    return new Response(
      JSON.stringify({ itinerary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
