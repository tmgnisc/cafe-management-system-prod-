import { cn, humanize } from "@/lib/utils";
import type { OrderStatus, PaymentMethod, Role, StockStatus, TableStatus, UserStatus, MovementType } from "@/types";

const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

const tone = {
  green: "bg-success-soft text-[oklch(0.42_0.1_150)] ring-success/25",
  amber: "bg-warning-soft text-[oklch(0.48_0.12_65)] ring-warning/30",
  red: "bg-danger-soft text-destructive ring-destructive/25",
  blue: "bg-info-soft text-info ring-info/25",
  brown: "bg-secondary text-primary ring-primary/20",
  gray: "bg-muted text-muted-foreground ring-border",
  caramel: "bg-accent text-accent-foreground ring-caramel/30",
} as const;

export type Tone = keyof typeof tone;

export function Pill({ tone: t = "gray", className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn(base, tone[t], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const tableStatusTone: Record<TableStatus, Tone> = {
  AVAILABLE: "green",
  OCCUPIED: "brown",
  RESERVED: "blue",
  CLEANING: "amber",
  INACTIVE: "gray",
};

export function TableStatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  return (
    <Pill tone={tableStatusTone[status]} dot className={className}>
      {humanize(status)}
    </Pill>
  );
}

export const orderStatusTone: Record<OrderStatus, Tone> = {
  DRAFT: "gray",
  PENDING: "amber",
  CONFIRMED: "blue",
  PREPARING: "caramel",
  READY: "blue",
  SERVED: "brown",
  COMPLETED: "green",
  CANCELLED: "red",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Pill tone={orderStatusTone[status]} dot className={className}>
      {humanize(status)}
    </Pill>
  );
}

export function PaymentStatusBadge({ status }: { status: "PAID" | "UNPAID" }) {
  return <Pill tone={status === "PAID" ? "green" : "amber"}>{humanize(status)}</Pill>;
}

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const t: Record<StockStatus, Tone> = { IN_STOCK: "green", LOW_STOCK: "amber", OUT_OF_STOCK: "red" };
  return (
    <Pill tone={t[status]} dot className={className}>
      {humanize(status)}
    </Pill>
  );
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod | null }) {
  if (!method) return <span className="text-muted-foreground">—</span>;
  const t: Record<PaymentMethod, Tone> = { CASH: "green", CARD: "blue", ESEWA: "green", KHALTI: "caramel", BANK_TRANSFER: "brown", OTHER: "gray" };
  return <Pill tone={t[method]}>{humanize(method)}</Pill>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Pill tone={role === "SUPERADMIN" ? "brown" : "caramel"}>{humanize(role)}</Pill>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Pill tone={status === "ACTIVE" ? "green" : "gray"} dot>
      {humanize(status)}
    </Pill>
  );
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const t: Record<MovementType, Tone> = {
    INITIAL_STOCK: "gray",
    PURCHASE: "green",
    SALE: "brown",
    ADJUSTMENT: "blue",
    WASTE: "red",
    RETURN: "caramel",
  };
  return <Pill tone={t[type]}>{humanize(type)}</Pill>;
}
