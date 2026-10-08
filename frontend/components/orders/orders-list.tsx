"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { OrderStatusBadge, PaymentMethodBadge } from "@/components/shared/status-badges";
import { CompleteOrderButton } from "@/components/orders/complete-order-button";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/currency";
import { cn, formatDateTime, humanize, timeAgo } from "@/lib/utils";
import { PAYMENT_METHODS, type OrderStatus, type PaymentMethod } from "@/types";

const isOpen = (status: OrderStatus) => status !== "COMPLETED" && status !== "CANCELLED";

const TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export function OrdersList({ title = "Orders" }: { title?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);

  const filters = {
    page,
    per_page: 20,
    search: debounced,
    status: tab === "open" || tab === "" ? undefined : tab,
    open: tab === "open" ? true : undefined,
    from: from || undefined,
    to: to || undefined,
    payment_method: method,
  };
  const query = useQuery({
    queryKey: qk.orders(filters),
    queryFn: () => api.getOrders(filters),
    placeholderData: keepPreviousData,
    refetchInterval: tab === "open" ? 15_000 : false,
  });

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };
  const hasFilters = !!(debounced || from || to || method);
  const items = query.data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader icon={ClipboardList} title={title} description="Every order, from the first espresso to the last brownie." />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => resetPage(setTab)(t.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Order #, table or staff…" />
          <div className="flex items-center gap-2">
            <Input type="date" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} className="h-9 w-[150px] bg-card" aria-label="From date" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} className="h-9 w-[150px] bg-card" aria-label="To date" />
          </div>
          <Select value={method || "ALL"} onValueChange={(v) => resetPage(setMethod)(v === "ALL" ? "" : (v as PaymentMethod))}>
            <SelectTrigger className="h-9 w-[170px] bg-card" aria-label="Payment method">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All payment methods</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {humanize(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFrom("");
                setTo("");
                setMethod("");
                setPage(1);
              }}
            >
              <X /> Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-2 sm:p-4">
        {query.isLoading ? (
          <LoadingState rows={8} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={ClipboardList} title={tab === "open" ? "No active orders" : "No orders found"} description={hasFilters ? "Try adjusting the filters." : "Orders will appear here as soon as they are taken."} />
        ) : (
          <>
            {/* Desktop table */}
            <div className={cn("hidden md:block", query.isFetching && "opacity-70 transition-opacity")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-28 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                      <TableCell>
                        <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{o.table_name}</TableCell>
                      <TableCell className="text-center tabular-nums">{o.item_count}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentMethodBadge method={o.payment_method} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{o.created_by_name}</TableCell>
                      <TableCell className="text-muted-foreground" title={formatDateTime(o.created_at)}>
                        {formatDateTime(o.created_at, "dd MMM, h:mm a")}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(o.grand_total)}</TableCell>
                      <TableCell className="text-right">{isOpen(o.status) && <CompleteOrderButton orderId={o.id} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {items.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <Link href={`/orders/${o.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-3">
                    <div className="min-w-0">
                      <div className="font-medium">{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.table_name} · {o.item_count} items · {timeAgo(o.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{formatCurrency(o.grand_total)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </Link>
                  {isOpen(o.status) && <CompleteOrderButton orderId={o.id} className="shrink-0" />}
                </li>
              ))}
            </ul>
            <Pagination meta={query.data?.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
