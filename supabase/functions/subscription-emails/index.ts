import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailPayload {
  type: "trial_expiring" | "trial_expired" | "upgrade" | "downgrade" | "payment_failed" | "cancellation";
  companyId: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { type, companyId, metadata } = (await req.json()) as EmailPayload;

    if (!type || !companyId) {
      return new Response(JSON.stringify({ error: "Missing type or companyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company info
    const { data: company } = await adminClient
      .from("companies")
      .select("name, email, slug")
      .eq("id", companyId)
      .single();

    if (!company?.email) {
      return new Response(JSON.stringify({ error: "Company not found or no email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company admin users for notification
    const { data: admins } = await adminClient
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("role", "company_admin")
      .eq("is_active", true);

    const adminUserIds = (admins || []).map((a) => a.user_id);

    // Fetch subscription info
    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("*, plans(name, slug)")
      .eq("company_id", companyId)
      .in("status", ["active", "trialing", "canceled", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const planName = (subscription?.plans as any)?.name || "Unknown";
    const trialEndsAt = subscription?.trial_ends_at;

    // Build email content based on type
    let subject = "";
    let body = "";
    const companyName = company.name;

    switch (type) {
      case "trial_expiring": {
        const daysLeft = metadata?.daysLeft || 3;
        subject = `Your trial expires in ${daysLeft} days — ${companyName}`;
        body = `
          <h2>Your free trial is ending soon</h2>
          <p>Hi ${companyName} team,</p>
          <p>Your ${planName} trial will expire in <strong>${daysLeft} days</strong>${trialEndsAt ? ` on ${new Date(trialEndsAt).toLocaleDateString()}` : ""}.</p>
          <p>To keep access to all your data and features, upgrade to a paid plan before your trial ends.</p>
          <p><a href="https://safar.app/dashboard/billing" style="display:inline-block;padding:12px 24px;background:#F59E0B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Upgrade Now</a></p>
          <p>If you have any questions, reply to this email or contact our support team.</p>
        `;
        break;
      }
      case "trial_expired": {
        subject = `Your trial has expired — ${companyName}`;
        body = `
          <h2>Your free trial has ended</h2>
          <p>Hi ${companyName} team,</p>
          <p>Your ${planName} trial has expired. Your account is now in read-only mode.</p>
          <p>Upgrade to a paid plan to regain full access to your bookings, leads, and all features.</p>
          <p><a href="https://safar.app/dashboard/billing" style="display:inline-block;padding:12px 24px;background:#F59E0B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Choose a Plan</a></p>
        `;
        break;
      }
      case "upgrade": {
        const newPlan = (metadata?.newPlanName as string) || planName;
        subject = `Plan upgraded to ${newPlan} — ${companyName}`;
        body = `
          <h2>Welcome to ${newPlan}! 🎉</h2>
          <p>Hi ${companyName} team,</p>
          <p>Your subscription has been successfully upgraded to <strong>${newPlan}</strong>.</p>
          <p>You now have access to all the features included in your new plan. Start exploring your upgraded tools right away.</p>
          <p><a href="https://safar.app/dashboard" style="display:inline-block;padding:12px 24px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a></p>
        `;
        break;
      }
      case "downgrade": {
        const newPlan = (metadata?.newPlanName as string) || planName;
        subject = `Plan changed to ${newPlan} — ${companyName}`;
        body = `
          <h2>Plan change confirmed</h2>
          <p>Hi ${companyName} team,</p>
          <p>Your subscription has been changed to <strong>${newPlan}</strong>.</p>
          <p>Please note that some features may no longer be available. If your usage exceeds the new plan limits, you'll need to adjust before the change fully takes effect.</p>
          <p><a href="https://safar.app/dashboard/billing" style="display:inline-block;padding:12px 24px;background:#6B7280;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Billing</a></p>
        `;
        break;
      }
      case "payment_failed": {
        subject = `Payment failed — Action required for ${companyName}`;
        body = `
          <h2>Payment failed</h2>
          <p>Hi ${companyName} team,</p>
          <p>We were unable to process your payment for the <strong>${planName}</strong> plan.</p>
          <p>Please update your payment method to avoid service interruption.</p>
          <p><a href="https://safar.app/dashboard/billing" style="display:inline-block;padding:12px 24px;background:#EF4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Update Payment Method</a></p>
        `;
        break;
      }
      case "cancellation": {
        const periodEnd = subscription?.current_period_end
          ? new Date(subscription.current_period_end).toLocaleDateString()
          : "end of current period";
        subject = `Subscription cancelled — ${companyName}`;
        body = `
          <h2>Subscription cancelled</h2>
          <p>Hi ${companyName} team,</p>
          <p>Your <strong>${planName}</strong> subscription has been cancelled.</p>
          <p>You'll continue to have access until <strong>${periodEnd}</strong>. After that, your account will switch to read-only mode.</p>
          <p>Changed your mind? You can reactivate anytime before the period ends.</p>
          <p><a href="https://safar.app/dashboard/billing" style="display:inline-block;padding:12px 24px;background:#F59E0B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reactivate Subscription</a></p>
        `;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Create notifications for company admins
    const notificationInserts = adminUserIds.map((userId) => ({
      user_id: userId,
      company_id: companyId,
      type: `subscription_${type}`,
      title: subject,
      message: body.replace(/<[^>]*>/g, "").substring(0, 200),
      entity_type: "subscription",
      entity_id: subscription?.id || null,
      is_read: false,
      is_reminder: type === "trial_expiring",
      metadata: { emailType: type, ...metadata },
    }));

    if (notificationInserts.length > 0) {
      await adminClient.from("notifications").insert(notificationInserts);
    }

    // Log as audit entry
    await adminClient.from("audit_logs").insert({
      entity_type: "subscription",
      action: `email_${type}`,
      entity_id: subscription?.id || null,
      company_id: companyId,
      new_data: { emailType: type, subject, recipientCount: adminUserIds.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        type,
        companyId,
        notifiedUsers: adminUserIds.length,
        subject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Subscription email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
