import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate_description") {
      systemPrompt = `You are a travel product copywriter. Generate compelling, professional descriptions for travel service items. Be concise but evocative. Return ONLY the description text, no formatting or labels. Keep it to 2-3 sentences.`;
      userPrompt = `Write a description for a travel ${data.category} called "${data.title}"${data.city ? ` in ${data.city}` : ""}${data.country ? `, ${data.country}` : ""}.${data.hints ? ` Additional context: ${data.hints}` : ""}`;
    } else if (action === "suggest_tags") {
      systemPrompt = `You are a travel industry expert. Suggest relevant tags for travel service items. Return a JSON array of 5-8 short tag strings (2-3 words each). Only return the JSON array, nothing else.`;
      userPrompt = `Suggest tags for: ${data.category} - "${data.title}"${data.city ? ` in ${data.city}` : ""}. ${data.description || ""}`;
    } else if (action === "enhance_notes") {
      systemPrompt = `You are a travel operations assistant. Enhance internal notes with practical operational details. Return the enhanced notes text only, keep it concise and actionable.`;
      userPrompt = `Enhance these internal notes for a ${data.category}: "${data.notes}". Title: "${data.title}"${data.city ? `, City: ${data.city}` : ""}`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("library-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
