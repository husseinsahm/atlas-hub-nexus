import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { title, totalDays, cities, description, tripType, language = "en" } = await req.json();

    if (!title || !totalDays) {
      throw new Error("Missing required fields: title and totalDays");
    }

    const isArabic = language === "ar";
    const citiesList = Array.isArray(cities) && cities.length > 0 ? cities.join(", ") : "";

    const systemPrompt = isArabic
      ? `أنت خبير في تخطيط الرحلات السياحية. أنشئ برنامج رحلة مفصل ومحترف.
قم بإرجاع JSON فقط بالتنسيق التالي:
{
  "days": [
    {
      "day_number": 1,
      "title": "عنوان اليوم",
      "city": "اسم المدينة",
      "short_description": "وصف مختصر في سطر واحد",
      "description": "وصف تفصيلي للأنشطة",
      "items": [
        {
          "category": "activity|hotel|transfer|meal|guide|attraction",
          "title": "عنوان الخدمة",
          "description": "وصف الخدمة",
          "duration_minutes": 120
        }
      ]
    }
  ]
}
اجعل المحتوى واقعي ومفيد للمسافرين.`
      : `You are an expert travel itinerary planner. Create a detailed, professional itinerary.
Return ONLY valid JSON in this exact format:
{
  "days": [
    {
      "day_number": 1,
      "title": "Day title describing the theme",
      "city": "City name",
      "short_description": "One-line summary",
      "description": "Detailed description of the day's activities",
      "items": [
        {
          "category": "activity|hotel|transfer|meal|guide|attraction",
          "title": "Service title",
          "description": "Service description",
          "duration_minutes": 120
        }
      ]
    }
  ]
}
Make content realistic and helpful for travelers. Include varied activities each day.`;

    const userPrompt = isArabic
      ? `أنشئ برنامج رحلة لـ "${title}" لمدة ${totalDays} يوم${citiesList ? ` في: ${citiesList}` : ""}${description ? `. الوصف: ${description}` : ""}${tripType ? `. نوع الرحلة: ${tripType}` : ""}.

أضف لكل يوم:
- عنوان ملهم
- 2-4 خدمات (مزيج من الأنشطة والفنادق والنقل والوجبات)
- أوصاف واقعية وجذابة`
      : `Create an itinerary for "${title}" spanning ${totalDays} days${citiesList ? ` visiting: ${citiesList}` : ""}${description ? `. Description: ${description}` : ""}${tripType ? `. Trip type: ${tripType}` : ""}.

For each day include:
- Inspiring title
- 2-4 services (mix of activities, hotels, transfers, meals)
- Realistic, engaging descriptions`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error(`AI gateway error [${response.status}]:`, errorText);
      throw new Error("Failed to generate itinerary");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse JSON from response (handle markdown code blocks)
    let itinerary;
    try {
      let cleanJson = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      
      itinerary = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content:", content);
      throw new Error("Invalid response format from AI");
    }

    return new Response(
      JSON.stringify({ success: true, itinerary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate template error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
