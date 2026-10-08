"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Loader2,
  Percent,
  Printer,
  Smartphone,
  Tag,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { cn, humanize } from "@/lib/utils";
import type { DiscountType, Order, PaymentMethod, Settings } from "@/types";
import { PAYMENT_METHODS } from "@/types";

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  ESEWA: Wallet,
  KHALTI: Smartphone,
  BANK_TRANSFER: Landmark,
  OTHER: CircleDollarSign,
};

type Step = "bill" | "pay" | "done";

export function BillDialog({
  open,
  onOpenChange,
  order,
  settings,
  onOrderChange,
  onPaid,
  doneLabel = "Back to tables",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  settings: Settings | undefined;
  onOrderChange: (order: Order) => void;
  onPaid: (order: Order) => void;
  /** Label of the closing button after a successful payment. */
  doneLabel?: string;
}) {
  const [step, setStep] = useState<Step>("bill");
  const [paidOrder, setPaidOrder] = useState<Order | null>(null);

  const handleOpenChange = (v: boolean) => {
    if (!v && step === "done" && paidOrder) onPaid(paidOrder);
    if (!v) setStep("bill");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={step !== "done"}>
        {step === "bill" && <BillStep order={order} settings={settings} onOrderChange={onOrderChange} onPay={() => setStep("pay")} />}
        {step === "pay" && (
          <PayStep
            order={order}
            onBack={() => setStep("bill")}
            onOrderChange={onOrderChange}
            onPaid={(o) => {
              setPaidOrder(o);
              setStep("done");
            }}
          />
        )}
        {step === "done" && paidOrder && <DoneStep order={paidOrder} doneLabel={doneLabel} onClose={() => handleOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Step 1: bill + discount

function BillStep({ order, settings, onOrderChange, onPay }: { order: Order; settings: Settings | undefined; onOrderChange: (o: Order) => void; onPay: () => void }) {
  const { isAdmin } = useAuth();
  const canDiscount = isAdmin || !!settings?.staff_discount_enabled;
  const [type, setType] = useState<DiscountType>(order.discount_type ?? "PERCENTAGE");
  const [value, setValue] = useState<string>(order.discount_type ? String(order.discount_value) : "");
  const [showDiscount, setShowDiscount] = useState(!!order.discount_type);

  const discountMutation = useMutation({
    mutationFn: (args: { type: DiscountType | null; value?: number }) => api.applyDiscount(order.id, args.type, args.value),
    onSuccess: (o) => {
      onOrderChange(o);
      toast.success(o.discount_type ? `Discount of ${formatCurrency(o.discount_amount)} applied` : "Discount removed");
      if (!o.discount_type) {
        setValue("");
        setShowDiscount(false);
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const numeric = Number(value);
  const valueError =
    value === "" ? null : !Number.isFinite(numeric) || numeric <= 0 ? "Enter a positive amount" : type === "PERCENTAGE" && numeric > 100 ? "Cannot exceed 100%" : type === "FIXED" && numeric > order.subtotal ? "Cannot exceed the subtotal" : !isAdmin && settings && type === "PERCENTAGE" && numeric > settings.max_staff_discount_percent ? `Staff limit is ${settings.max_staff_discount_percent}%` : null;

  return (
    <>
      <DialogHeader className="border-b border-border bg-secondary/50 px-5 py-4 text-left">
        <DialogTitle className="font-display text-xl">Bill · {order.table_name}</DialogTitle>
        <DialogDescription>
          {order.order_number} · {order.items.reduce((s, i) => s + i.quantity, 0)} items
        </DialogDescription>
      </DialogHeader>

      <div className="scrollbar-thin max-h-[52vh] overflow-y-auto px-5 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase">
              <th className="pb-2 text-left font-medium">Item</th>
              <th className="pb-2 text-center font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-2">
                  <div className="font-medium">{i.item_name_snapshot}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(i.unit_price)}
                    {i.notes && <> · “{i.notes}”</>}
                  </div>
                </td>
                <td className="py-2 text-center tabular-nums">{i.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(i.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Discount */}
        <div className="mt-4 rounded-xl border border-border bg-background p-3">
          {!showDiscount ? (
            <button
              className="flex w-full items-center justify-between text-sm font-medium text-foreground/80 hover:text-foreground disabled:opacity-50"
              onClick={() => setShowDiscount(true)}
              disabled={!canDiscount}
            >
              <span className="flex items-center gap-2">
                <Tag className="size-4 text-caramel" /> {canDiscount ? "Apply a discount" : "Discounts are disabled for staff"}
              </span>
              {canDiscount && <span className="text-xs text-muted-foreground">{!isAdmin && settings ? `up to ${settings.max_staff_discount_percent}%` : ""}</span>}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Tag className="size-4 text-caramel" /> Discount
                </Label>
                {!isAdmin && settings && <span className="text-xs text-muted-foreground">Staff limit {settings.max_staff_discount_percent}%</span>}
              </div>
              <div className="flex gap-2">
                <div className="flex shrink-0 rounded-lg border border-border p-0.5">
                  {(["PERCENTAGE", "FIXED"] as DiscountType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={cn("rounded-md px-3 py-1.5 text-sm font-medium", type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                      aria-pressed={type === t}
                    >
                      {t === "PERCENTAGE" ? <Percent className="size-4" /> : "Rs."}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "PERCENTAGE" ? "e.g. 10" : "e.g. 50"}
                  className="h-10"
                  aria-invalid={!!valueError}
                  aria-label="Discount value"
                />
                <Button className="h-10" disabled={!value || !!valueError || discountMutation.isPending} onClick={() => discountMutation.mutate({ type, value: numeric })}>
                  {discountMutation.isPending ? <Loader2 className="animate-spin" /> : "Apply"}
                </Button>
                {order.discount_type && (
                  <Button variant="ghost" size="icon" className="size-10" onClick={() => discountMutation.mutate({ type: null })} aria-label="Remove discount" disabled={discountMutation.isPending}>
                    <X />
                  </Button>
                )}
              </div>
              {valueError && <p className="text-xs text-destructive">{valueError}</p>}
              {order.discount_applied_by_name && order.discount_type && (
                <p className="text-xs text-muted-foreground">Applied by {order.discount_applied_by_name}</p>
              )}
            </div>
          )}
        </div>

        <Totals order={order} settings={settings} className="mt-4" />
      </div>

      <div className="flex gap-2 border-t border-border bg-card px-5 py-4">
        <Button variant="outline" className="h-11" asChild>
          <Link href={`/receipt/${order.id}?print=1`} target="_blank">
            <Printer /> Pre-bill
          </Link>
        </Button>
        <Button className="h-11 flex-1 text-base" onClick={onPay}>
          Take payment · {formatCurrency(order.grand_total)}
        </Button>
      </div>
    </>
  );
}

export function Totals({ order, settings, className }: { order: Order; settings?: Settings; className?: string }) {
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      <Line label="Subtotal" value={formatCurrency(order.subtotal)} />
      <Line
        label={`Discount${order.discount_type === "PERCENTAGE" ? ` (${order.discount_value}%)` : ""}`}
        value={order.discount_amount > 0 ? `− ${formatCurrency(order.discount_amount)}` : formatCurrency(0)}
        tone={order.discount_amount > 0 ? "text-success" : undefined}
      />
      {order.service_charge_amount > 0 && <Line label={`Service charge (${order.service_charge_rate}%)`} value={formatCurrency(order.service_charge_amount)} />}
      <Line label={`${settings?.tax_label ?? "Tax"}${order.tax_rate > 0 ? ` (${order.tax_rate}%)` : ""}`} value={formatCurrency(order.tax_amount)} />
      <div className="flex items-baseline justify-between border-t border-dashed border-border pt-2">
        <dt className="font-display text-lg font-semibold">Grand total</dt>
        <dd className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(order.grand_total)}</dd>
      </div>
    </dl>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={cn("flex justify-between text-muted-foreground", tone)}>
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- Step 2: payment

function PayStep({ order, onBack, onOrderChange, onPaid }: { order: Order; onBack: () => void; onOrderChange: (o: Order) => void; onPaid: (o: Order) => void }) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState<string>(String(order.grand_total));
  const [reference, setReference] = useState("");
  const total = order.grand_total;
  const cash = method === "CASH";
  const tenderedNum = Number(tendered);
  const change = cash && Number.isFinite(tenderedNum) ? Math.max(0, Math.round((tenderedNum - total) * 100) / 100) : 0;
  const short = cash && (!Number.isFinite(tenderedNum) || tenderedNum < total);

  const quick = Array.from(new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])).filter((v) => v >= total).slice(0, 4);

  const payMutation = useMutation({
    mutationFn: () =>
      api.completePayment(order.id, {
        method,
        amount: cash ? tenderedNum : total,
        reference: reference.trim() || null,
        expected_total: total,
      }),
    onSuccess: (o) => {
      toast.success(`Payment of ${formatCurrency(o.grand_total)} received`);
      onPaid(o);
    },
    onError: async (err) => {
      toast.error(errorMessage(err));
      // Bill changed elsewhere, or already paid on another device → reload the order.
      if (err instanceof ApiError && err.status === 409) {
        try {
          const fresh = await api.getOrder(order.id);
          if (fresh.status === "COMPLETED") onPaid(fresh);
          else onOrderChange(fresh);
        } catch {
          /* ignore */
        }
      }
    },
  });

  return (
    <>
      <DialogHeader className="border-b border-border bg-secondary/50 px-5 py-4 text-left">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to bill" disabled={payMutation.isPending}>
            <ArrowLeft />
          </Button>
          <div>
            <DialogTitle className="font-display text-xl">Take payment</DialogTitle>
            <DialogDescription>
              {order.table_name} · {order.order_number}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-5 px-5 py-5">
        <div className="rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
          <div className="text-xs tracking-wider uppercase opacity-75">Amount due</div>
          <div className="font-display text-4xl font-semibold tabular-nums">{formatCurrency(total)}</div>
        </div>

        <div>
          <Label className="mb-2 block">Payment method</Label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m];
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm font-medium transition-all",
                    method === m ? "border-primary bg-secondary text-primary" : "border-border bg-card text-foreground/75 hover:border-primary/40",
                  )}
                >
                  <Icon className="size-5" />
                  {humanize(m)}
                </button>
              );
            })}
          </div>
        </div>

        {cash ? (
          <div className="space-y-2">
            <Label htmlFor="tendered">Cash received</Label>
            <Input
              id="tendered"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="h-12 text-lg font-semibold tabular-nums"
              aria-invalid={short}
            />
            <div className="flex flex-wrap gap-2">
              {quick.map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" onClick={() => setTendered(String(v))}>
                  {v === total ? "Exact" : formatCurrency(v)}
                </Button>
              ))}
            </div>
            <div className={cn("flex items-center justify-between rounded-xl px-4 py-3", short ? "bg-danger-soft text-destructive" : "bg-success-soft")}>
              <span className="text-sm font-medium">{short ? "Amount is less than the bill" : "Change to return"}</span>
              {!short && <span className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(change)}</span>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="reference">Reference / transaction ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} placeholder={method === "CARD" ? "Last 4 digits / approval code" : "Transaction ID"} className="h-11" />
            <p className="text-xs text-muted-foreground">The exact bill amount of {formatCurrency(total)} will be recorded.</p>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card px-5 py-4">
        <Button className="h-12 w-full text-base" disabled={short || payMutation.isPending} onClick={() => payMutation.mutate()}>
          {payMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Complete payment
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Step 3: done

function DoneStep({ order, doneLabel, onClose }: { order: Order; doneLabel: string; onClose: () => void }) {
  return (
    <div className="px-6 py-8 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft">
        <CheckCircle2 className="size-9 text-success" />
      </div>
      <DialogTitle className="mt-4 font-display text-2xl">Payment complete</DialogTitle>
      <DialogDescription className="mt-1">
        {order.order_number} · {formatCurrency(order.grand_total)} by {humanize(order.payment?.method)}
      </DialogDescription>
      {order.payment && order.payment.change_amount > 0 && (
        <div className="mx-auto mt-5 max-w-xs rounded-2xl bg-secondary px-5 py-4">
          <div className="text-xs tracking-wider text-muted-foreground uppercase">Change due</div>
          <div className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(order.payment.change_amount)}</div>
        </div>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{order.table_name} is now free and stock has been updated.</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" asChild>
          <Link href={`/receipt/${order.id}?print=1`} target="_blank">
            <Printer /> Print receipt
          </Link>
        </Button>
        <Button className="h-11" onClick={onClose}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
