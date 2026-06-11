// Client portal document upload — anonymous file upload, validated via share token.
// Accepts JSON: { token, file_name, file_type, category, uploader_name, data_base64 }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "attachments";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_CATEGORIES = ["passport", "visa", "voucher", "ticket", "other"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const { token, file_name, file_type, category, uploader_name, data_base64 } = body;

    if (!token || typeof token !== "string") return json({ error: "Missing token" }, 400);
    if (!file_name || typeof file_name !== "string" || file_name.length > 200)
      return json({ error: "Invalid file_name" }, 400);
    if (!file_type || !ALLOWED.includes(file_type))
      return json({ error: "File type not allowed. Use JPG, PNG, WEBP, or PDF." }, 400);
    if (!data_base64 || typeof data_base64 !== "string")
      return json({ error: "Missing file data" }, 400);
    if (!ALLOWED_CATEGORIES.includes(category)) return json({ error: "Invalid category" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Validate token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("booking_share_tokens")
      .select("booking_id, is_active, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow || !tokenRow.is_active) return json({ error: "Invalid or expired link" }, 403);
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date())
      return json({ error: "Link expired" }, 403);

    // 2) Decode + size check
    let bytes: Uint8Array;
    try {
      const binary = atob(data_base64);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return json({ error: "Could not decode file data" }, 400);
    }
    if (bytes.byteLength > MAX_BYTES)
      return json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, 400);

    // 3) Upload to private bucket
    const cleanName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = cleanName.includes(".") ? cleanName.slice(cleanName.lastIndexOf(".")) : "";
    const path = `client-uploads/${tokenRow.booking_id}/${crypto.randomUUID()}${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file_type, upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    // 4) Signed URL (7 days) so client + agency can preview
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);

    // 5) Insert booking_attachments row
    const { data: row, error: insErr } = await supabase
      .from("booking_attachments")
      .insert({
        booking_id: tokenRow.booking_id,
        file_name: cleanName,
        file_url: signed?.signedUrl || path,
        file_type,
        file_size: bytes.byteLength,
        category,
        is_client_upload: true,
        client_uploader_name: (uploader_name || "").toString().slice(0, 120) || null,
      })
      .select("id, file_name, category, created_at")
      .single();

    if (insErr) return json({ error: insErr.message }, 500);

    // 6) Activity log so the agency sees it in the timeline
    await supabase.from("booking_activities").insert({
      booking_id: tokenRow.booking_id,
      activity_type: "client_upload",
      title: `Client uploaded ${category}: ${cleanName}`,
    });

    return json({ ok: true, attachment: row });
  } catch (e) {
    console.error("[client-portal-upload]", e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
