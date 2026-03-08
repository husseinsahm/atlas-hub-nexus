import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, serviceType, language } = await req.json();
    if (!title?.trim()) throw new Error("Title is required");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = language === "ar"
      ? `أنت مساعد لشركة سياحة. حسّن عنوان الخدمة التالي ليكون أكثر احترافية ووضوحاً. نوع الخدمة: ${serviceType}. أعد العنوان المحسّن فقط بدون أي شرح أو علامات ترقيم إضافية. اجعله قصيراً وواضحاً.`
      : `You are a travel agency assistant. Enhance the following service title to be more professional and descriptive. Service type: ${serviceType}. Return ONLY the enhanced title, no explanation, no quotes, no extra punctuation. Keep it concise (under 80 chars).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: title },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim() || title;

    return new Response(JSON.stringify({ enhanced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
