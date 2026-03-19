import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1",
      className
    )}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold font-display text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-1 font-body">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
