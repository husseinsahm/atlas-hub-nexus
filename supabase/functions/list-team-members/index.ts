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

    const { companyId } = await req.json();
    if (!companyId) throw new Error("Missing companyId");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is a member of this company
    const { data: callerMembership } = await adminClient
      .from("company_memberships")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    // Also check super_admin
    const { data: superRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!callerMembership && !superRole) {
      throw new Error("Not a member of this company");
    }

    // Fetch memberships
    const { data: memberships, error: mErr } = await adminClient
      .from("company_memberships")
      .select("id, user_id, role, is_active, created_at")
      .eq("company_id", companyId);

    if (mErr) throw new Error(mErr.message);

    // Fetch profiles
    const userIds = (memberships || []).map((m: any) => m.user_id);
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, avatar_url, phone")
      .in("id", userIds);

    const profilesMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profilesMap[p.id] = p; });

    // Fetch emails from auth
    const { data: { users: authUsers }, error: listErr } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    const emailMap: Record<string, string> = {};
    if (!listErr && authUsers) {
      authUsers.forEach((u: any) => {
        if (userIds.includes(u.id)) {
          emailMap[u.id] = u.email || "";
        }
      });
    }

    const result = (memberships || []).map((m: any) => ({
      membershipId: m.id,
      userId: m.user_id,
      email: emailMap[m.user_id] || "",
      fullName: profilesMap[m.user_id]?.full_name || "Unknown",
      avatarUrl: profilesMap[m.user_id]?.avatar_url || null,
      phone: profilesMap[m.user_id]?.phone || null,
      role: m.role,
      isActive: m.is_active,
      joinedAt: m.created_at,
    }));

    return new Response(
      JSON.stringify({ members: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
