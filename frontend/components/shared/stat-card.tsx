import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "brown",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  accent?: "brown" | "caramel" | "green" | "amber" | "red" | "blue";
  className?: string;
}) {
  const accents = {
    brown: "bg-secondary text-primary",
    caramel: "bg-accent text-accent-foreground",
    green: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
    red: "bg-danger-soft text-destructive",
    blue: "bg-info-soft text-info",
  };
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_0_oklch(0.9_0.02_75)] sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {Icon && (
          <div className={cn("flex size-9 items-center justify-center rounded-xl", accents[accent])}>
            <Icon className="size-[18px]" />
          </div>
        )}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
