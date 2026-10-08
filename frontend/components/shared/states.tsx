import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Skeleton placeholder rows/cards. */
export function LoadingState({ rows = 5, variant = "rows", className }: { rows?: number; variant?: "rows" | "cards"; className?: string }) {
  if (variant === "cards") {
    return (
      <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-danger-soft/60 px-6 py-10 text-center", className)}>
      <AlertTriangle className="size-8 text-destructive" />
      <div>
        <p className="font-medium text-foreground">Couldn&apos;t load this data</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary/70">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-display text-lg font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
