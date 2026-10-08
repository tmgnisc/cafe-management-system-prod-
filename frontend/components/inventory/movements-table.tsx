import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MovementTypeBadge } from "@/components/shared/status-badges";
import { cn, formatDateTime, formatQty } from "@/lib/utils";
import type { StockMovement } from "@/types";

export function MovementReference({ m }: { m: StockMovement }) {
  if (m.reference_type === "ORDER" && m.reference_id) {
    return (
      <Link href={`/orders/${m.reference_id}`} className="font-medium text-primary underline-offset-2 hover:underline">
        {m.reference_label ?? `Order #${m.reference_id}`}
      </Link>
    );
  }
  return <span className="text-muted-foreground">{m.reason ?? "—"}</span>;
}

export function SignedQty({ m }: { m: StockMovement }) {
  const positive = m.quantity > 0;
  return (
    <span className={cn("font-medium tabular-nums", positive ? "text-success" : "text-destructive")}>
      {positive ? "+" : "−"}
      {formatQty(Math.abs(m.quantity))} {m.unit}
    </span>
  );
}

/** Desktop table + stacked cards on small screens. */
export function MovementsTable({ movements, showItem = true }: { movements: StockMovement[]; showItem?: boolean }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showItem && <TableHead>Item</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Reference / reason</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.created_at, "dd MMM, h:mm a")}</TableCell>
                {showItem && <TableCell className="font-medium">{m.inventory_item_name}</TableCell>}
                <TableCell>
                  <MovementTypeBadge type={m.type} />
                </TableCell>
                <TableCell className="text-right">
                  <SignedQty m={m} />
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatQty(m.previous_quantity)} <ArrowRight className="inline size-3" /> <span className="text-foreground">{formatQty(m.new_quantity)}</span>
                </TableCell>
                <TableCell className="max-w-56 truncate">
                  <MovementReference m={m} />
                  {m.reference_type === "ORDER" && m.reason && <span className="sr-only">{m.reason}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.created_by_name ?? "System"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden">
        {movements.map((m) => (
          <li key={m.id} className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MovementTypeBadge type={m.type} />
                {showItem && <span className="font-medium">{m.inventory_item_name}</span>}
              </div>
              <SignedQty m={m} />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {formatQty(m.previous_quantity)} → {formatQty(m.new_quantity)} {m.unit}
              </span>
              <span>{formatDateTime(m.created_at, "dd MMM, h:mm a")}</span>
            </div>
            <div className="mt-1 truncate text-xs">
              <MovementReference m={m} /> · {m.created_by_name ?? "System"}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
