import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles, Lock, ArrowRight } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  requiredPlan: string;
  description?: string;
}

/**
 * Reusable upgrade modal shown when a gated feature is accessed.
 */
export function UpgradeModal({ open, onOpenChange, featureName, requiredPlan, description }: UpgradeModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <DialogTitle className="text-xl">Upgrade to access {featureName}</DialogTitle>
          <DialogDescription className="text-center mt-2">
            {description || `This feature is available on the ${requiredPlan} plan and above. Upgrade now to unlock it.`}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-4 rounded-lg bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground text-center">
            Available on <span className="font-bold text-accent">{requiredPlan}</span> plan
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Maybe Later
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/billing");
            }}
            className="flex-1 bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade Now
            <ArrowRight className="w-4 h-4 rtl:scale-x-[-1]" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
