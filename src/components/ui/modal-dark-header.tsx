import * as React from "react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalDarkHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function ModalDarkHeader({ icon, title, description, badge, className }: ModalDarkHeaderProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-t-lg", className)}>
      {/* Dark navy background */}
      <div className="bg-primary px-6 py-5">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-accent/10 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-20 h-20 rounded-full bg-accent/5 translate-y-1/2" />

        <DialogHeader className="relative z-10 space-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center shadow-lg ring-2 ring-accent/20">
                {icon}
              </div>
              <div>
                <DialogTitle className="font-display text-lg text-primary-foreground tracking-tight">
                  {title}
                </DialogTitle>
                {description && (
                  <DialogDescription className="text-sm text-primary-foreground/60 mt-0.5">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
            {badge && <div className="flex items-center gap-2">{badge}</div>}
          </div>
        </DialogHeader>
      </div>
    </div>
  );
}
