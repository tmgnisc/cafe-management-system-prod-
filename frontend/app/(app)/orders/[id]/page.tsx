"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Clock, CreditCard, LayoutGrid, Package, Printer, ReceiptText, Tag, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from "@/components/shared/status-badges";
import { Totals } from "@/components/billing/bill-dialog";
import { CompleteOrderButton } from "@/components/orders/complete-order-button";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, formatQty, humanize } from "@/lib/utils";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const { isAdmin } = useAuth();
  const settings = useSettings().data;
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const query = useQuery({ queryKey: qk.order(orderId), queryFn: () => api.getOrder(orderId) });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelOrder(orderId, reason.trim()),
    onSuccess: (o) => {
      queryClient.setQueryData(qk.order(o.id), o);
      void queryClient.invalidateQueries({ queryKey: qk.ordersAll });
      void queryClient.invalidateQueries({ queryKey: qk.tablesAll });
      toast.success(`Order ${o.order_number} cancelled`);
      setCancelOpen(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <PageContainer>
        <LoadingState rows={10} />
      </PageContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <PageContainer>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </PageContainer>
    );
  }

  const o = query.data;
  const timeline = [
    { label: "Created", at: o.created_at, by: o.created_by_name },
    { label: "Sent to kitchen", at: o.sent_at },
    { label: "Served", at: o.served_at },
    { label: "Completed", at: o.completed_at, by: o.completed_by_name },
    { label: "Cancelled", at: o.cancelled_at, by: o.cancelled_by_name },
  ].filter((t) => t.at);

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link href={isAdmin ? "/admin/orders" : "/orders"}>
              <ArrowLeft /> All orders
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{o.order_number}</h1>
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.payment_status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {o.table_name} · {formatDateTime(o.created_at)} · by {o.created_by_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {o.is_editable && (
            <>
              <CompleteOrderButton orderId={o.id} size="default" />
              <Button variant="outline" asChild>
                <Link href={`/pos/table/${o.table_id}`}>
                  <LayoutGrid /> Open in POS
                </Link>
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}>
                <Ban /> Cancel order
              </Button>
            </>
          )}
          <Button variant="outline" asChild>
            <Link href={`/receipt/${o.id}?print=1`} target="_blank">
              <Printer /> {o.payment_status === "PAID" ? "Print receipt" : "Print pre-bill"}
            </Link>
          </Button>
        </div>
      </div>

      {!o.is_editable && o.status === "COMPLETED" && (
        <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          This order is completed and locked — items, prices and payment can no longer be changed.
        </div>
      )}
      {o.status === "CANCELLED" && o.cancel_reason && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft px-4 py-3 text-sm">
          <span className="font-medium text-destructive">Cancelled:</span> {o.cancel_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <ReceiptText className="size-5 text-primary" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {o.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium">
                        {i.item_name_snapshot} <span className="text-muted-foreground">× {i.quantity}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(i.unit_price)} each{i.category_snapshot && ` · ${i.category_snapshot}`}
                      </div>
                      {i.notes && <div className="mt-1 inline-block rounded bg-warning-soft px-1.5 py-0.5 text-xs">“{i.notes}”</div>}
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <Totals order={o} settings={settings} className="mt-4 border-t border-border pt-4" />
              {o.discount_type && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Tag className="size-3.5" />
                  {o.discount_type === "PERCENTAGE" ? `${o.discount_value}%` : formatCurrency(o.discount_value)} discount applied by {o.discount_applied_by_name ?? "—"}
                </p>
              )}
            </CardContent>
          </Card>

          {o.stock_movements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Package className="size-5 text-primary" /> Inventory deducted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {o.stock_movements.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-medium">{m.inventory_item_name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        <span className="font-semibold text-destructive">
                          {formatQty(m.quantity)} {m.unit}
                        </span>{" "}
                        · {formatQty(m.previous_quantity)} → {formatQty(m.new_quantity)} {m.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <CreditCard className="size-5 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {o.payment ? (
                <>
                  <Info label="Method" value={<PaymentMethodBadge method={o.payment.method} />} />
                  <Info label="Amount" value={formatCurrency(o.payment.amount)} />
                  {o.payment.method === "CASH" && (
                    <>
                      <Info label="Received" value={formatCurrency(o.payment.tendered_amount)} />
                      <Info label="Change" value={formatCurrency(o.payment.change_amount)} />
                    </>
                  )}
                  {o.payment.reference && <Info label="Reference" value={o.payment.reference} />}
                  <Info label="Status" value={humanize(o.payment.status)} />
                  <Info label="Received by" value={o.payment.received_by_name} />
                  <Info label="Paid at" value={formatDateTime(o.payment.paid_at)} />
                </>
              ) : (
                <p className="text-muted-foreground">{o.status === "CANCELLED" ? "No payment — order was cancelled." : "Not paid yet."}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Clock className="size-5 text-primary" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {timeline.map((t) => (
                  <li key={t.label}>
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-caramel" />
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(t.at)}
                      {t.by && (
                        <>
                          {" "}
                          · <User className="inline size-3" /> {t.by}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {o.notes && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">Note: {o.notes}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel order ${o.order_number}?`}
        description="The table will be released. No stock is deducted for cancelled orders."
        confirmLabel="Cancel order"
        destructive
        loading={cancelMutation.isPending}
        onConfirm={() => (reason.trim().length >= 3 ? cancelMutation.mutate() : toast.error("Please give a reason (at least 3 characters)"))}
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancelling" maxLength={255} />
      </ConfirmDialog>
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
