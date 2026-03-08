import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !callingUser) throw new Error("Unauthorized");

    const { membershipId, companyId, deleteUser } = await req.json();

    if (!membershipId || !companyId) {
      throw new Error("Missing required fields: membershipId, companyId");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify calling user is admin
    const { data: membership } = await adminClient
      .from("company_memberships")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    if (!membership || !["company_admin"].includes(membership.role)) {
      const { data: superRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callingUser.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!superRole) throw new Error("Only company admins can delete team members");
    }

    // Get the target membership to find user_id
    const { data: targetMembership } = await adminClient
      .from("company_memberships")
      .select("user_id")
      .eq("id", membershipId)
      .eq("company_id", companyId)
      .single();

    if (!targetMembership) throw new Error("Member not found");

    // Prevent self-delete
    if (targetMembership.user_id === callingUser.id) {
      throw new Error("Cannot delete yourself");
    }

    // Delete membership
    await adminClient.from("company_memberships").delete().eq("id", membershipId);

    // Optionally delete the auth user entirely
    if (deleteUser) {
      await adminClient.auth.admin.deleteUser(targetMembership.user_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});