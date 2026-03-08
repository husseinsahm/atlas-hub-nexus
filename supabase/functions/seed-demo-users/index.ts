import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const demoUsers = [
    { email: "admin@safar.com", full_name: "Super Admin", platformRole: "super_admin" as const },
    { email: "company@safar.com", full_name: "Company Manager", companyRole: "company_admin" as const },
    { email: "agent@safar.com", full_name: "Travel Agent", companyRole: "agent" as const },
    { email: "ops@safar.com", full_name: "Operations Lead", companyRole: "operations" as const },
    { email: "finance@safar.com", full_name: "Finance Officer", companyRole: "finance" as const },
  ];

  const results: any[] = [];

  // 1. Create a demo company
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", "demo-travel-co")
    .maybeSingle();

  let companyId: string;
  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany, error: companyErr } = await supabase
      .from("companies")
      .insert({ name: "Demo Travel Co", slug: "demo-travel-co", email: "info@demotravel.com", is_active: true })
      .select("id")
      .single();
    if (companyErr) return new Response(JSON.stringify({ error: companyErr.message }), { status: 500, headers: corsHeaders });
    companyId = newCompany.id;
  }

  for (const demo of demoUsers) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === demo.email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      // Update password
      await supabase.auth.admin.updateUserById(userId, { password: demo.email });
      results.push({ email: demo.email, status: "updated" });
    } else {
      const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: demo.email,
        email_confirm: true,
        user_metadata: { full_name: demo.full_name },
      });
      if (authErr) {
        results.push({ email: demo.email, status: "error", error: authErr.message });
        continue;
      }
      userId = newUser.user.id;
      results.push({ email: demo.email, status: "created" });
    }

    // Ensure profile exists (trigger should handle, but just in case)
    await supabase.from("profiles").upsert({ id: userId, full_name: demo.full_name }, { onConflict: "id" });

    // Platform role (super_admin)
    if (demo.platformRole) {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", demo.platformRole)
        .maybeSingle();
      if (!existingRole) {
        await supabase.from("user_roles").insert({ user_id: userId, role: demo.platformRole });
      }
    }

    // Company membership
    if (demo.companyRole) {
      const { data: existingMembership } = await supabase
        .from("company_memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!existingMembership) {
        await supabase.from("company_memberships").insert({
          user_id: userId,
          company_id: companyId,
          role: demo.companyRole,
          is_active: true,
        });
      }
    }

    // Also give super_admin a company_admin membership for full access
    if (demo.platformRole === "super_admin") {
      const { data: existingMembership } = await supabase
        .from("company_memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!existingMembership) {
        await supabase.from("company_memberships").insert({
          user_id: userId,
          company_id: companyId,
          role: "company_admin",
          is_active: true,
        });
      }
    }
  }

  return new Response(JSON.stringify({ success: true, companyId, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
