"use client";

import { useState } from "react";
import {
  Ban,
  ChefHat,
  CheckCheck,
  Loader2,
  Minus,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Receipt,
  Save,
  Send,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, previewBill } from "@/lib/currency";
import { cn, humanize } from "@/lib/utils";
import type { CafeTable, Order, OrderStatus, Settings } from "@/types";
import type { CartLine } from "./use-cart";

type Busy = "save" | "send" | "bill" | null;

export function OrderPanel({
  table,
  order,
  lines,
  subtotal,
  dirty,
  settings,
  busy,
  onQuantity,
  onNotes,
  onRemove,
  onSave,
  onSend,
  onBill,
  onStatus,
  onCancel,
  onDiscard,
  onClose,
  className,
}: {
  table: CafeTable;
  order: Order | null;
  lines: CartLine[];
  subtotal: number;
  dirty: boolean;
  settings: Settings | undefined;
  busy: Busy;
  onQuantity: (key: string, qty: number) => void;
  onNotes: (key: string, notes: string) => void;
  onRemove: (key: string) => void;
  onSave: () => void;
  onSend: () => void;
  onBill: () => void;
  onStatus: (status: OrderStatus) => void;
  onCancel: () => void;
  onDiscard: () => void;
  /** Rendered as a close button in the header (mobile sheet). */
  onClose?: () => void;
  className?: string;
}) {
  const [noteOpen, setNoteOpen] = useState<string | null>(null);

  // Server totals are authoritative; while editing we show a display-only preview.
  const bill = !dirty && order
    ? { subtotal: order.subtotal, discount: order.discount_amount, serviceCharge: order.service_charge_amount, tax: order.tax_amount, total: order.grand_total }
    : previewBill(
        subtotal,
        { type: order?.discount_type ?? null, value: order?.discount_value ?? 0 },
        {
          tax_rate: settings?.tax_rate ?? 0,
          service_charge_rate: settings?.service_charge_rate ?? 0,
          tax_on_service_charge: settings?.tax_on_service_charge ?? true,
        },
      );

  const unsent = lines.filter((l) => !l.sent).length;
  const hasLines = lines.length > 0;
  const canSend = hasLines && (dirty || unsent > 0 || order?.status === "DRAFT" || !order);
  const kitchenNext: OrderStatus[] = order && order.status !== "DRAFT" ? (["PREPARING", "READY", "SERVED"] as OrderStatus[]).filter((s) => s !== order.status) : [];

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">{table.name}</h2>
            {order && <OrderStatusBadge status={order.status} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {order ? `${order.order_number} · by ${order.created_by_name}` : `${table.capacity} seats · ${table.section} · new order`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
        {order && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Order actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {kitchenNext.length > 0 && (
                <>
                  <DropdownMenuLabel>Kitchen status</DropdownMenuLabel>
                  {kitchenNext.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => onStatus(s)}>
                      {s === "SERVED" ? <CheckCheck /> : <ChefHat />} Mark {humanize(s).toLowerCase()}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {dirty && (
                <DropdownMenuItem onClick={onDiscard}>
                  <Ban /> Discard unsaved changes
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={onCancel}>
                <Trash2 /> Cancel order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close order panel">
            <X />
          </Button>
        )}
        </div>
      </div>

      {/* Lines */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {!hasLines ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <ShoppingBag className="size-9 text-primary/40" />
            <p className="font-display text-lg text-foreground">No items yet</p>
            <p className="text-sm">Tap menu items to add them to this table&apos;s order.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {lines.map((l) => (
              <li key={l.key} className={cn("px-4 py-3", !l.sent && order && "bg-accent/30")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(l.unit_price)} each
                      {l.sent ? (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-success">
                          <ChefHat className="size-3" /> sent
                        </span>
                      ) : order ? (
                        <span className="ml-2 font-medium text-caramel">new</span>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(Math.round(l.unit_price * 100 * l.quantity) / 100)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-full border border-border bg-background">
                    <button className="flex size-9 items-center justify-center rounded-full text-foreground/70 hover:bg-secondary hover:text-foreground" onClick={() => onQuantity(l.key, l.quantity - 1)} aria-label={`Decrease ${l.name}`}>
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{l.quantity}</span>
                    <button className="flex size-9 items-center justify-center rounded-full text-foreground/70 hover:bg-secondary hover:text-foreground" onClick={() => onQuantity(l.key, l.quantity + 1)} aria-label={`Increase ${l.name}`}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant={l.notes ? "secondary" : "ghost"} size="sm" onClick={() => setNoteOpen(noteOpen === l.key ? null : l.key)} aria-label="Add note">
                      <NotebookPen /> {l.notes ? "Note" : "Add note"}
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-danger-soft hover:text-destructive" onClick={() => onRemove(l.key)} aria-label={`Remove ${l.name}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                {noteOpen === l.key ? (
                  <Input
                    autoFocus
                    value={l.notes}
                    onChange={(e) => onNotes(l.key, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setNoteOpen(null)}
                    onBlur={() => setNoteOpen(null)}
                    placeholder="e.g. Less sugar, no onion…"
                    maxLength={255}
                    className="mt-2 h-9"
                  />
                ) : (
                  l.notes && <p className="mt-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-[oklch(0.45_0.1_65)]">“{l.notes}”</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + actions */}
      <div className="border-t border-border bg-secondary/40 px-4 pt-3 pb-4">
        <dl className="space-y-1 text-sm">
          <Row label="Subtotal" value={formatCurrency(bill.subtotal)} />
          {bill.discount > 0 && (
            <Row
              label={`Discount${order?.discount_type === "PERCENTAGE" ? ` (${order.discount_value}%)` : ""}`}
              value={`− ${formatCurrency(bill.discount)}`}
              className="text-success"
            />
          )}
          {bill.serviceCharge > 0 && <Row label={`Service charge (${settings?.service_charge_rate ?? order?.service_charge_rate}%)`} value={formatCurrency(bill.serviceCharge)} />}
          {bill.tax > 0 && <Row label={`${settings?.tax_label ?? "Tax"} (${settings?.tax_rate ?? order?.tax_rate}%)`} value={formatCurrency(bill.tax)} />}
          <div className="flex items-baseline justify-between border-t border-dashed border-border pt-2">
            <dt className="font-display text-lg font-semibold">Total</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(bill.total)}</dd>
          </div>
          {dirty && <p className="text-right text-[11px] text-muted-foreground">Unsaved changes — preview total</p>}
        </dl>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" disabled={!hasLines || !dirty || busy !== null} onClick={onSave}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button className="h-11 bg-caramel text-sidebar-primary-foreground hover:bg-caramel/90" disabled={!canSend || busy !== null} onClick={onSend}>
            {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
            {order && order.status !== "DRAFT" ? `Send ${unsent > 0 ? `(${unsent})` : ""}` : "Send order"}
          </Button>
          <Button className="col-span-2 h-12 text-base" disabled={!hasLines || busy !== null} onClick={onBill}>
            {busy === "bill" ? <Loader2 className="animate-spin" /> : <Receipt />} View bill
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between text-muted-foreground", className)}>
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
