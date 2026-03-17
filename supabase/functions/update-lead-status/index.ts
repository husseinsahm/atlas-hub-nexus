import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_STATUSES = new Set([
  "new",
  "contacted",
  "planning",
  "awaiting_client",
  "won",
  "lost",
]);

const ALLOWED_ROLES = new Set(["company_admin", "agent"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { leadId, status } = await req.json();
    if (!leadId || typeof leadId !== "string") {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return new Response(JSON.stringify({ error: "Invalid lead status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: lead, error: leadErr } = await adminClient
      .from("leads")
      .select("id, company_id, status")
      .eq("id", leadId)
      .is("deleted_at", null)
      .maybeSingle();

    if (leadErr) {
      console.error("[update-lead-status] Failed to load lead", { leadId, leadErr });
      return new Response(JSON.stringify({ error: leadErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [membershipRes, superRoleRes] = await Promise.all([
      adminClient
        .from("company_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", lead.company_id)
        .eq("is_active", true)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle(),
    ]);

    const role = membershipRes.data?.role ?? null;
    const isSuperAdmin = Boolean(superRoleRes.data);
    const isAllowed = isSuperAdmin || (role ? ALLOWED_ROLES.has(role) : false);

    if (!isAllowed) {
      console.warn("[update-lead-status] Unauthorized update attempt", {
        userId: user.id,
        leadId,
        companyId: lead.company_id,
        role,
        isSuperAdmin,
      });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updatedLead, error: updateErr } = await adminClient
      .from("leads")
      .update({ status })
      .eq("id", leadId)
      .eq("company_id", lead.company_id)
      .select("id, status, company_id, updated_at")
      .single();

    if (updateErr) {
      console.error("[update-lead-status] Failed to update status", {
        leadId,
        requestedStatus: status,
        updateErr,
      });
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[update-lead-status] Lead status updated", {
      userId: user.id,
      leadId,
      oldStatus: lead.status,
      newStatus: updatedLead.status,
    });

    return new Response(JSON.stringify({ data: updatedLead }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[update-lead-status] Unexpected error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
