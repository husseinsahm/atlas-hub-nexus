import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth } from "date-fns";

export interface PlanLimits {
  planId: string | null;
  planName: string;
  planSlug: string;
  // Limits
  maxUsers: number | null;
  maxBranches: number | null;
  maxTripsPerMonth: number | null;
  // Features
  features: string[];
  // Usage
  currentUsers: number;
  currentBranches: number;
  tripsThisMonth: number;
  // Computed
  canAddUser: boolean;
  canAddBranch: boolean;
  canCreateTrip: boolean;
  usersRemaining: number | null;
  branchesRemaining: number | null;
  tripsRemaining: number | null;
  // Plan status
  isOnFreeTier: boolean;
  hasSubscription: boolean;
}

const DEFAULT_LIMITS: PlanLimits = {
  planId: null,
  planName: "Free",
  planSlug: "free",
  maxUsers: 1,
  maxBranches: 1,
  maxTripsPerMonth: 10,
  features: [],
  currentUsers: 0,
  currentBranches: 0,
  tripsThisMonth: 0,
  canAddUser: false,
  canAddBranch: false,
  canCreateTrip: true,
  usersRemaining: 0,
  branchesRemaining: 0,
  tripsRemaining: 10,
  isOnFreeTier: true,
  hasSubscription: false,
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
          plans (
            id,
            name,
            slug,
            max_users,
            max_branches,
            max_trips,
            features
          )
        `)
        .eq("company_id", companyId)
        .eq("status", "active")
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
          .from("trips")
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
        // No active subscription - use free tier defaults
        return {
          ...DEFAULT_LIMITS,
          currentUsers,
          currentBranches,
          tripsThisMonth,
          canAddUser: currentUsers < 1,
          canAddBranch: currentBranches < 1,
          canCreateTrip: tripsThisMonth < 10,
          usersRemaining: Math.max(0, 1 - currentUsers),
          branchesRemaining: Math.max(0, 1 - currentBranches),
          tripsRemaining: Math.max(0, 10 - tripsThisMonth),
        };
      }

      const plan = subscription.plans as any;
      const maxUsers = plan.max_users;
      const maxBranches = plan.max_branches;
      const maxTripsPerMonth = plan.max_trips;
      const features = Array.isArray(plan.features) ? plan.features : [];

      // null means unlimited
      const canAddUser = maxUsers === null || currentUsers < maxUsers;
      const canAddBranch = maxBranches === null || currentBranches < maxBranches;
      const canCreateTrip = maxTripsPerMonth === null || tripsThisMonth < maxTripsPerMonth;

      const usersRemaining = maxUsers === null ? null : Math.max(0, maxUsers - currentUsers);
      const branchesRemaining = maxBranches === null ? null : Math.max(0, maxBranches - currentBranches);
      const tripsRemaining = maxTripsPerMonth === null ? null : Math.max(0, maxTripsPerMonth - tripsThisMonth);

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
      };
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });

  const hasFeature = (featureName: string): boolean => {
    if (!limits) return false;
    return limits.features.includes(featureName);
  };

  return {
    limits: limits || DEFAULT_LIMITS,
    isLoading,
    refetch,
    hasFeature,
  };
}
