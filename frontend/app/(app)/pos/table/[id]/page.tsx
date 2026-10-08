"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronUp, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { TableStatusBadge } from "@/components/shared/status-badges";
import { BillDialog } from "@/components/billing/bill-dialog";
import { CategoryRail, MenuGrid, MenuSearch } from "@/components/pos/menu-browser";
import { OrderPanel } from "@/components/pos/order-panel";
import { useCart } from "@/components/pos/use-cart";
import { useSettings } from "@/hooks/use-settings";
import { api, ApiError, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatCurrency, previewBill } from "@/lib/currency";
import type { Order, OrderStatus } from "@/types";

type Busy = "save" | "send" | "bill" | null;

export default function PosTablePage() {
  const params = useParams<{ id: string }>();
  const tableId = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const settings = useSettings().data;

  const tableQuery = useQuery({ queryKey: qk.table(tableId), queryFn: () => api.getTable(tableId), enabled: Number.isFinite(tableId), refetchInterval: 20_000 });
  const orderId = tableQuery.data?.current_order_id ?? null;
  const orderQuery = useQuery({ queryKey: qk.order(orderId ?? 0), queryFn: () => api.getOrder(orderId!), enabled: !!orderId });
  const categoriesQuery = useQuery({ queryKey: qk.categories(), queryFn: () => api.getCategories() });
  const menuQuery = useQuery({ queryKey: qk.menu({ pos: true }), queryFn: () => api.getMenuItems({ pos: true, per_page: 500 }) });

  const order: Order | null = orderId ? (orderQuery.data ?? null) : null;
  const cart = useCart(order);

  const [category, setCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const menuItems = useMemo(() => menuQuery.data?.items ?? [], [menuQuery.data]);
  const counts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const m of menuItems) c[m.category_id] = (c[m.category_id] ?? 0) + 1;
    return c;
  }, [menuItems]);
  const categories = useMemo(() => (categoriesQuery.data ?? []).filter((c) => counts[c.id]), [categoriesQuery.data, counts]);
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((m) => (category === "all" || m.category_id === category) && (!q || m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)));
  }, [menuItems, category, search]);
  const inCart = useMemo(() => {
    const m: Record<number, number> = {};
    for (const l of cart.lines) m[l.menu_item_id] = (m[l.menu_item_id] ?? 0) + l.quantity;
    return m;
  }, [cart.lines]);

  const storeOrder = (o: Order) => {
    queryClient.setQueryData(qk.order(o.id), o);
    void queryClient.invalidateQueries({ queryKey: qk.table(tableId) });
    void queryClient.invalidateQueries({ queryKey: qk.tablesAll });
    void queryClient.invalidateQueries({ queryKey: qk.ordersAll });
  };

  /** Persist the cart (create or update) and optionally send new lines to the kitchen. */
  const persist = async (send: boolean): Promise<Order> => {
    let o: Order;
    if (!order) {
      o = await api.createOrder({ table_id: tableId, items: cart.payload(), send });
    } else {
      o = cart.dirty ? await api.updateOrder(order.id, { items: cart.payload() }) : order;
      if (send && (o.unsent_item_count > 0 || o.status === "DRAFT")) o = await api.sendOrder(o.id);
    }
    // Make the table query point at this order before storing it.
    queryClient.setQueryData(qk.table(tableId), (t: typeof tableQuery.data) => (t ? { ...t, status: "OCCUPIED", current_order_id: o.id } : t));
    storeOrder(o);
    return o;
  };

  const run = async (kind: Exclude<Busy, null>, send: boolean, after?: (o: Order) => void) => {
    setBusy(kind);
    try {
      const o = await persist(send);
      after?.(o);
    } catch (err) {
      toast.error(errorMessage(err));
      if (err instanceof ApiError && err.status === 409) void tableQuery.refetch();
    } finally {
      setBusy(null);
    }
  };

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => api.setOrderStatus(order!.id, status),
    onSuccess: (o) => {
      storeOrder(o);
      toast.success(`Order marked ${o.status.toLowerCase()}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelOrder(order!.id, cancelReason.trim()),
    onSuccess: (o) => {
      storeOrder(o);
      toast.success(`Order ${o.order_number} cancelled`);
      setCancelOpen(false);
      router.push("/pos");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (tableQuery.isLoading || (orderId && orderQuery.isLoading)) {
    return (
      <div className="p-6">
        <LoadingState rows={8} />
      </div>
    );
  }
  if (tableQuery.isError || orderQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState error={tableQuery.error ?? orderQuery.error} onRetry={() => void (tableQuery.refetch(), orderQuery.refetch())} />
      </div>
    );
  }
  const table = tableQuery.data!;
  if (!table.is_active) {
    return (
      <div className="p-6">
        <ErrorState error={new Error(`${table.name} is inactive.`)} />
      </div>
    );
  }

  const renderPanel = (onClose?: () => void) => (
    <OrderPanel
      table={table}
      order={order}
      lines={cart.lines}
      subtotal={cart.subtotal}
      dirty={cart.dirty}
      settings={settings}
      busy={busy}
      onQuantity={cart.setQuantity}
      onNotes={cart.setNotes}
      onRemove={cart.remove}
      onSave={() => run("save", false, (o) => toast.success(order ? "Order updated" : `Order ${o.order_number} saved`))}
      onSend={() => run("send", true, (o) => toast.success(`Order ${o.order_number} sent to the kitchen`))}
      onBill={() =>
        run("bill", false, () => {
          setMobileOrderOpen(false);
          setBillOpen(true);
        })
      }
      onStatus={(s) => statusMutation.mutate(s)}
      onCancel={() => setCancelOpen(true)}
      onDiscard={cart.reset}
      onClose={onClose}
      className="h-full"
    />
  );

  const previewTotal = previewBill(cart.subtotal, { type: order?.discount_type ?? null, value: order?.discount_value ?? 0 }, {
    tax_rate: settings?.tax_rate ?? 0,
    service_charge_rate: settings?.service_charge_rate ?? 0,
    tax_on_service_charge: settings?.tax_on_service_charge ?? true,
  }).total;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col lg:h-dvh">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pos">
            <ArrowLeft /> Tables
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-display text-lg font-semibold">{table.name}</span>
          <TableStatusBadge status={table.status} />
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <Users className="size-3.5" /> {table.capacity} · {table.section}
          </span>
        </div>
        {(statusMutation.isPending || orderQuery.isFetching) && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Categories — desktop rail */}
        <aside className="scrollbar-thin hidden w-52 shrink-0 overflow-y-auto border-r border-border bg-card/50 p-3 lg:block">
          <CategoryRail categories={categories} active={category} onSelect={setCategory} counts={counts} orientation="vertical" />
        </aside>

        {/* Menu */}
        <section className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-3 pt-3 pb-28 sm:px-4 md:pb-4">
          <div className="sticky top-0 z-10 -mx-3 space-y-3 bg-background/90 px-3 pb-3 backdrop-blur sm:-mx-4 sm:px-4">
            <MenuSearch value={search} onChange={setSearch} />
            <div className="lg:hidden">
              <CategoryRail categories={categories} active={category} onSelect={setCategory} counts={counts} orientation="horizontal" />
            </div>
          </div>
          {menuQuery.isLoading || categoriesQuery.isLoading ? (
            <LoadingState variant="cards" rows={9} />
          ) : menuQuery.isError ? (
            <ErrorState error={menuQuery.error} onRetry={() => menuQuery.refetch()} />
          ) : (
            <MenuGrid items={visibleItems} onAdd={cart.add} inCart={inCart} disabled={busy !== null} />
          )}
        </section>

        {/* Order panel — tablet/desktop */}
        <aside className="hidden w-[340px] shrink-0 border-l border-border md:block xl:w-[380px]">{renderPanel()}</aside>
      </div>

      {/* Mobile sticky order summary */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 shadow-[0_-8px_24px_-12px_oklch(0.3_0.03_50/.35)] backdrop-blur md:hidden">
        <Button className="h-13 w-full justify-between rounded-xl px-4 text-base" onClick={() => setMobileOrderOpen(true)}>
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/20 text-sm tabular-nums">{cart.itemCount}</span>
            View order {cart.dirty && <span className="text-xs opacity-75">· unsaved</span>}
          </span>
          <span className="flex items-center gap-1 font-display tabular-nums">
            {formatCurrency(cart.dirty || !order ? previewTotal : order.grand_total)} <ChevronUp className="size-4" />
          </span>
        </Button>
      </div>
      <Sheet open={mobileOrderOpen} onOpenChange={setMobileOrderOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[88dvh] overflow-hidden rounded-t-2xl p-0 md:hidden">
          <SheetTitle className="sr-only">Current order</SheetTitle>
          {renderPanel(() => setMobileOrderOpen(false))}
        </SheetContent>
      </Sheet>

      {order && (
        <BillDialog
          open={billOpen}
          onOpenChange={setBillOpen}
          order={order}
          settings={settings}
          onOrderChange={storeOrder}
          onPaid={(o) => {
            storeOrder(o);
            void queryClient.invalidateQueries({ queryKey: qk.dashboard });
            router.push("/pos");
          }}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel order ${order?.order_number ?? ""}?`}
        description="The table will be released. Cancelled orders stay in history and no stock is deducted."
        confirmLabel="Cancel order"
        destructive
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelReason.trim().length < 3) {
            toast.error("Please give a reason (at least 3 characters)");
            return;
          }
          cancelMutation.mutate();
        }}
      >
        <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason, e.g. customer left" maxLength={255} />
      </ConfirmDialog>
    </div>
  );
}
