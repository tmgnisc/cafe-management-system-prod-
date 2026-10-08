"use client";

import Link from "next/link";
import { Clock, MoreVertical, Receipt, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusBadge, TableStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency } from "@/lib/currency";
import { cn, timeAgo } from "@/lib/utils";
import type { CafeTable } from "@/types";

const statusStyles: Record<CafeTable["status"], string> = {
  AVAILABLE: "border-success/30 bg-card hover:border-success/60 hover:shadow-[0_6px_24px_-12px_oklch(0.58_0.11_150/.5)]",
  OCCUPIED: "border-primary/35 bg-gradient-to-br from-secondary to-card hover:border-primary/60 hover:shadow-[0_6px_24px_-12px_oklch(0.42_0.075_50/.5)]",
  RESERVED: "border-info/30 bg-info-soft/40 hover:border-info/60",
  CLEANING: "border-warning/40 bg-warning-soft/50 hover:border-warning/70",
  INACTIVE: "border-border bg-muted opacity-60",
};

const stripe: Record<CafeTable["status"], string> = {
  AVAILABLE: "bg-success",
  OCCUPIED: "bg-primary",
  RESERVED: "bg-info",
  CLEANING: "bg-warning",
  INACTIVE: "bg-muted-foreground",
};

export function TableCard({
  table,
  onSetStatus,
}: {
  table: CafeTable;
  onSetStatus: (table: CafeTable, status: "AVAILABLE" | "RESERVED" | "CLEANING") => void;
}) {
  const occupied = table.status === "OCCUPIED" && table.current_order_id;
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border-2 transition-all", statusStyles[table.status])}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", stripe[table.status])} />
      <Link href={`/pos/table/${table.id}`} className="block p-4 pl-5 focus-visible:outline-none" aria-label={`Open ${table.name}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Table</div>
            <div className="font-display text-3xl leading-none font-semibold tabular-nums">{table.table_number}</div>
          </div>
          <TableStatusBadge status={table.status} />
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {table.capacity} seats
          </span>
          <span className="truncate">{table.section}</span>
        </div>

        {occupied ? (
          <div className="mt-3 space-y-1.5 border-t border-primary/15 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xl font-semibold tabular-nums">{formatCurrency(table.current_order_total)}</span>
              <span className="text-xs text-muted-foreground">{table.current_order_item_count} items</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {table.current_order_status && <OrderStatusBadge status={table.current_order_status} />}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> {timeAgo(table.current_order_started_at)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 border-t border-dashed border-border pt-3 text-sm font-medium text-muted-foreground group-hover:text-foreground">
            {table.status === "AVAILABLE" ? "Tap to start order" : table.status === "RESERVED" ? "Reserved — tap to seat" : "Being cleaned"}
          </div>
        )}
      </Link>

      {!occupied && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-7 bg-card/80 backdrop-blur" aria-label="Table actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Set status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.status !== "AVAILABLE" && (
                <DropdownMenuItem onClick={() => onSetStatus(table, "AVAILABLE")}>
                  <Sparkles /> Mark available
                </DropdownMenuItem>
              )}
              {table.status !== "RESERVED" && (
                <DropdownMenuItem onClick={() => onSetStatus(table, "RESERVED")}>
                  <Receipt /> Mark reserved
                </DropdownMenuItem>
              )}
              {table.status !== "CLEANING" && (
                <DropdownMenuItem onClick={() => onSetStatus(table, "CLEANING")}>
                  <Sparkles /> Mark cleaning
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
