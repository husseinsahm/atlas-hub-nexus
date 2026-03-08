import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon, Plus, Search, FileX, Inbox, AlertCircle, RefreshCw } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error" | "minimal";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const variantStyles = {
    default: {
      container: "bg-muted/30 border border-dashed border-border",
      icon: "bg-muted text-muted-foreground",
    },
    search: {
      container: "bg-transparent",
      icon: "bg-muted text-muted-foreground",
    },
    error: {
      container: "bg-destructive/5 border border-destructive/20",
      icon: "bg-destructive/10 text-destructive",
    },
    minimal: {
      container: "bg-transparent",
      icon: "bg-muted/50 text-muted-foreground",
    },
  };

  const styles = variantStyles[variant];
  const ActionIcon = action?.icon || Plus;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg p-8 text-center",
        styles.container,
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
          styles.icon
        )}
      >
        <Icon className="h-7 w-7" />
      </div>
      
      <h3 className="mb-1 text-lg font-semibold text-foreground">{title}</h3>
      
      {description && (
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && (
            <Button onClick={action.onClick} size="sm" className="gap-2">
              <ActionIcon className="h-4 w-4" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size="sm"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
interface PresetEmptyStateProps {
  onAction?: () => void;
  className?: string;
}

export function NoBookingsEmptyState({ onAction, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={FileX}
      title="No bookings yet"
      description="Start by creating your first booking to manage travel arrangements for your clients."
      action={onAction ? { label: "Create Booking", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoLeadsEmptyState({ onAction, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Inbox}
      title="No leads found"
      description="Capture potential clients by adding new leads. Convert them to bookings when they're ready."
      action={onAction ? { label: "Add Lead", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoCustomersEmptyState({ onAction, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Inbox}
      title="No customers yet"
      description="Your customer database is empty. Add your first customer or convert leads to get started."
      action={onAction ? { label: "Add Customer", onClick: onAction } : undefined}
      className={className}
    />
  );
}

export function NoSearchResultsEmptyState({ 
  query, 
  onClear, 
  className 
}: PresetEmptyStateProps & { query?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={query ? `We couldn't find anything matching "${query}". Try a different search term.` : "Try adjusting your search or filters."}
      action={onClear ? { label: "Clear Search", onClick: onClear, icon: RefreshCw } : undefined}
      variant="search"
      className={className}
    />
  );
}

export function ErrorEmptyState({ 
  onRetry, 
  message,
  className 
}: PresetEmptyStateProps & { onRetry?: () => void; message?: string }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description={message || "We encountered an error loading this data. Please try again."}
      action={onRetry ? { label: "Retry", onClick: onRetry, icon: RefreshCw } : undefined}
      variant="error"
      className={className}
    />
  );
}
