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

    // Client to verify the calling user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !callingUser) throw new Error("Unauthorized");

    const { email, password, fullName, role, companyId } = await req.json();

    if (!email || !password || !fullName || !role || !companyId) {
      throw new Error("Missing required fields: email, password, fullName, role, companyId");
    }

    // Verify calling user is admin of this company
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership } = await adminClient
      .from("company_memberships")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    if (!membership || !["company_admin"].includes(membership.role)) {
      // Also check super_admin
      const { data: superRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callingUser.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superRole) throw new Error("Only company admins can create team members");
    }

    // Create auth user (auto-confirmed)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr) throw new Error(createErr.message);

    const userId = newUser.user.id;

    // Create profile
    await adminClient.from("profiles").upsert({
      id: userId,
      full_name: fullName,
    });

    // Create company membership
    const { error: memberErr } = await adminClient.from("company_memberships").insert({
      user_id: userId,
      company_id: companyId,
      role,
      is_active: true,
    });

    if (memberErr) throw new Error(memberErr.message);

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});