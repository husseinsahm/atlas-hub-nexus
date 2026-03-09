import React from "react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Conditionally renders children only if the current plan includes the specified feature.
 * Shows an upgrade prompt or custom fallback if the feature is not available.
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, limits } = usePlanLimits();
  const navigate = useNavigate();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border bg-muted/30 text-center">
      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <Lock className="w-6 h-6 text-accent" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Upgrade to unlock {feature}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        This feature is not available on the {limits.planName} plan. 
        Upgrade to access {feature} and more premium features.
      </p>
      <Button 
        onClick={() => navigate("/dashboard/billing")}
        className="gold-gradient text-accent-foreground gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Upgrade Plan
      </Button>
    </div>
  );
}

/**
 * Simple check component - renders nothing or children based on feature availability
 */
export function HasFeature({ 
  feature, 
  children 
}: { 
  feature: string; 
  children: React.ReactNode;
}) {
  const { hasFeature } = usePlanLimits();
  return hasFeature(feature) ? <>{children}</> : null;
}

/**
 * Badge to indicate a feature requires upgrade
 */
export function UpgradeBadge({ feature }: { feature: string }) {
  const { hasFeature } = usePlanLimits();
  
  if (hasFeature(feature)) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
      <Sparkles className="w-3 h-3" />
      PRO
    </span>
  );
}
