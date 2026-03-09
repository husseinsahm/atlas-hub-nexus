import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  ja: "Japanese",
  es: "Spanish",
  fr: "French",
  zh: "Chinese (Simplified)",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ko: "Korean",
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

    const { content, targetLanguages, sourceLanguage = "en" } = await req.json();

    if (!content || !targetLanguages || !Array.isArray(targetLanguages)) {
      throw new Error("Missing required fields: content, targetLanguages");
    }

    const translations: Record<string, any> = {};

    // Translate to each target language
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const targetLangName = LANGUAGE_NAMES[targetLang] || targetLang;
      const sourceLangName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;

      const systemPrompt = `You are a professional travel content translator. Translate the following travel itinerary content from ${sourceLangName} to ${targetLangName}.

CRITICAL RULES:
1. Maintain the exact JSON structure - only translate string values
2. Keep all keys in English (do not translate keys)
3. Preserve formatting, numbers, dates, and currency symbols
4. Keep proper nouns (hotel names, landmark names, city names) recognizable but can add transliteration in parentheses for non-Latin scripts
5. Use natural, professional travel industry language
6. For RTL languages (Arabic), ensure the text flows naturally
7. Return ONLY valid JSON, no additional text or markdown

Translate this JSON content:`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(content, null, 2) },
          ],
          temperature: 0.3,
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
        throw new Error(`Translation failed for ${targetLang}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content;

      if (translatedText) {
        try {
          // Clean up potential markdown code blocks
          let cleanJson = translatedText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          
          translations[targetLang] = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error(`Failed to parse translation for ${targetLang}:`, parseError);
          // Store raw text as fallback
          translations[targetLang] = { raw: translatedText, parseError: true };
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, translations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
