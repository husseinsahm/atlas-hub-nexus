import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, differenceInDays, isPast } from "date-fns";

export interface PlanLimits {
  planId: string | null;
  planName: string;
  planSlug: string;
  maxUsers: number | null;
  maxBranches: number | null;
  maxTripsPerMonth: number | null;
  features: string[];
  currentUsers: number;
  currentBranches: number;
  tripsThisMonth: number;
  // Computed — NOTE: If a plan's max is reduced (e.g., max_users from 10 to 5)
  // but a company already has 8 users, canAddUser will be false but existing
  // users are NOT blocked. Only new additions are prevented.
  canAddUser: boolean;
  canAddBranch: boolean;
  canCreateTrip: boolean;
  usersRemaining: number | null;
  branchesRemaining: number | null;
  tripsRemaining: number | null;
  isOnFreeTier: boolean;
  hasSubscription: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  isTrialing: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  /** True if the company's current plan has been deactivated by admin */
  planDeactivated: boolean;
}

const DEFAULT_LIMITS: PlanLimits = {
  planId: null,
  planName: "Free",
  planSlug: "free",
  maxUsers: 1,
  maxBranches: 0,
  maxTripsPerMonth: 5,
  features: [],
  currentUsers: 0,
  currentBranches: 0,
  tripsThisMonth: 0,
  canAddUser: false,
  canAddBranch: false,
  canCreateTrip: true,
  usersRemaining: 0,
  branchesRemaining: 0,
  tripsRemaining: 5,
  isOnFreeTier: true,
  hasSubscription: false,
  subscriptionId: null,
  subscriptionStatus: "none",
  billingCycle: "monthly",
  currentPeriodEnd: null,
  canceledAt: null,
  isTrialing: false,
  trialEndsAt: null,
  trialDaysRemaining: null,
  trialExpired: false,
  priceMonthly: 0,
  priceYearly: 0,
  currency: "USD",
  planDeactivated: false,
};

export function usePlanLimits() {
  const { user } = useAuth();
  const companyId = user?.activeMembership?.companyId;

  const { data: limits, isLoading, refetch } = useQuery({
    queryKey: ["plan-limits", companyId],
    queryFn: async (): Promise<PlanLimits> => {
      if (!companyId) return DEFAULT_LIMITS;

      // Fetch subscription with plan details
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
          id,
          status,
          plan_id,
          billing_cycle,
          current_period_end,
          canceled_at,
          trial_starts_at,
          trial_ends_at,
          plans (
            id,
            name,
            slug,
            max_users,
            max_branches,
            max_trips,
            features,
            price_monthly,
            price_yearly,
            currency,
            is_active
          )
        `)
        .eq("company_id", companyId)
        .in("status", ["active", "trialing", "past_due"])
        .single();

      // Fetch current usage in parallel
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const [usersRes, branchesRes, tripsRes] = await Promise.all([
        supabase
          .from("company_memberships")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("company_branches")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .is("deleted_at", null),
        supabase
          .from("bookings")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
      ]);

      const currentUsers = usersRes.count || 0;
      const currentBranches = branchesRes.count || 0;
      const tripsThisMonth = tripsRes.count || 0;

      if (!subscription?.plans) {
        return {
          ...DEFAULT_LIMITS,
          currentUsers,
          currentBranches,
          tripsThisMonth,
          canAddUser: currentUsers < 1,
          canAddBranch: false,
          canCreateTrip: tripsThisMonth < 5,
          usersRemaining: Math.max(0, 1 - currentUsers),
          branchesRemaining: 0,
          tripsRemaining: Math.max(0, 5 - tripsThisMonth),
        };
      }

      const plan = subscription.plans as any;
      const planDeactivated = plan.is_active === false;
      const maxUsers = plan.max_users;
      const maxBranches = plan.max_branches;
      const maxTripsPerMonth = plan.max_trips;
      const features = Array.isArray(plan.features) ? plan.features : [];

      const canAddUser = maxUsers === null || currentUsers < maxUsers;
      const canAddBranch = maxBranches === null || currentBranches < maxBranches;
      const canCreateTrip = maxTripsPerMonth === null || tripsThisMonth < maxTripsPerMonth;

      const usersRemaining = maxUsers === null ? null : Math.max(0, maxUsers - currentUsers);
      const branchesRemaining = maxBranches === null ? null : Math.max(0, maxBranches - currentBranches);
      const tripsRemaining = maxTripsPerMonth === null ? null : Math.max(0, maxTripsPerMonth - tripsThisMonth);

      // Trial info
      const isTrialing = subscription.status === "trialing";
      const trialEndsAt = subscription.trial_ends_at;
      let trialDaysRemaining: number | null = null;
      let trialExpired = false;
      if (trialEndsAt) {
        const endDate = new Date(trialEndsAt);
        if (isPast(endDate)) {
          trialExpired = true;
          trialDaysRemaining = 0;
        } else {
          trialDaysRemaining = differenceInDays(endDate, now);
        }
      }

      return {
        planId: plan.id,
        planName: plan.name,
        planSlug: plan.slug,
        maxUsers,
        maxBranches,
        maxTripsPerMonth,
        features,
        currentUsers,
        currentBranches,
        tripsThisMonth,
        canAddUser,
        canAddBranch,
        canCreateTrip,
        usersRemaining,
        branchesRemaining,
        tripsRemaining,
        isOnFreeTier: false,
        hasSubscription: true,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        billingCycle: subscription.billing_cycle,
        currentPeriodEnd: subscription.current_period_end,
        canceledAt: subscription.canceled_at,
        isTrialing,
        trialEndsAt,
        trialDaysRemaining,
        trialExpired,
        priceMonthly: plan.price_monthly || 0,
        priceYearly: plan.price_yearly || 0,
        currency: plan.currency || "USD",
      };
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  const hasFeature = (featureName: string): boolean => {
    if (!limits) return false;
    return limits.features.includes(featureName);
  };

  const usagePercent = (type: "users" | "branches" | "trips"): number => {
    if (!limits) return 0;
    const configs = {
      users: { current: limits.currentUsers, max: limits.maxUsers },
      branches: { current: limits.currentBranches, max: limits.maxBranches },
      trips: { current: limits.tripsThisMonth, max: limits.maxTripsPerMonth },
    };
    const c = configs[type];
    if (c.max === null) return 0;
    return Math.min(100, Math.round((c.current / c.max) * 100));
  };

  return {
    limits: limits || DEFAULT_LIMITS,
    isLoading,
    refetch,
    hasFeature,
    usagePercent,
  };
}
