"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Banknote,
  ClipboardList,
  LayoutGrid,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { OrderStatusBadge, StockStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { ChartCard, RankedBars, SalesBarChart, trimHourly } from "@/components/dashboard/charts";
import { Segmented } from "@/components/dashboard/segmented";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { formatQty, humanize, timeAgo } from "@/lib/utils";
import type { Dashboard } from "@/types";

type Range = "today" | "week" | "month";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function VsYesterday({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday <= 0) return <span>{today > 0 ? "No sales yesterday" : "No sales yet today"}</span>;
  const pct = ((today - yesterday) / yesterday) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={up ? "size-3.5 text-success" : "size-3.5 text-destructive"} />
      <span className={up ? "text-success" : "text-destructive"}>
        {up ? "+" : ""}
        {pct.toFixed(0)}%
      </span>
      vs yesterday ({formatCurrency(yesterday)})
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const [range, setRange] = useState<Range>("today");
  const query = useQuery<Dashboard>({ queryKey: qk.dashboard, queryFn: api.getDashboard, refetchInterval: 60_000 });
  const d = query.data;

  const cafeName = settings?.cafe_name ?? "Isha's Cozy Cafe";

  return (
    <PageContainer>
      <PageHeader
        title={`${greeting()}, ${user?.name.split(" ")[0] ?? ""}`}
        description={
          <>
            {cafeName} · {format(new Date(), "EEEE, d MMMM yyyy")}
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/reports">
                <BarChart3 /> Reports
              </Link>
            </Button>
            <Button asChild>
              <Link href="/pos">
                <LayoutGrid /> Open POS
              </Link>
            </Button>
          </>
        }
      />

      {query.isLoading ? (
        <>
          <LoadingState variant="cards" rows={8} />
          <LoadingState rows={6} />
        </>
      ) : query.isError || !d ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              className="col-span-2 lg:col-span-1"
              label="Today's sales"
              value={formatCurrency(d.today.total_collected)}
              icon={Banknote}
              accent="brown"
              hint={<VsYesterday today={d.today.total_collected} yesterday={d.yesterday.total_collected} />}
            />
            <StatCard label="Today's orders" value={d.today.orders} icon={Receipt} accent="caramel" hint={`${d.today.items_sold} items sold`} />
            <StatCard label="Avg. order value" value={formatCurrency(d.today.average_order_value)} icon={TrendingUp} accent="green" hint="Today, completed orders" />
            <StatCard
              label="Active orders"
              value={d.open_orders.count}
              icon={ClipboardList}
              accent="blue"
              hint={`${formatCurrency(d.open_orders.value)} on open tabs`}
            />
            <StatCard label="Available tables" value={`${d.tables.available} / ${d.tables.total}`} icon={UtensilsCrossed} accent="green" hint={`${d.tables.reserved} reserved · ${d.tables.cleaning} cleaning`} />
            <StatCard label="Occupied tables" value={d.tables.occupied} icon={Users} accent="caramel" hint={d.tables.total ? `${Math.round((d.tables.occupied / d.tables.total) * 100)}% occupancy` : undefined} />
            <StatCard
              label="Low stock items"
              value={d.low_stock_count}
              icon={AlertTriangle}
              accent={d.low_stock_count > 0 ? "amber" : "green"}
              hint={d.low_stock_count > 0 ? "Needs restocking" : "All stocked up"}
            />
            <StatCard label="This month" value={formatCurrency(d.month_summary.total_collected)} icon={BarChart3} accent="brown" hint={`${d.month_summary.orders} orders`} />
          </div>

          {/* Sales trend */}
          <ChartCard
            title={range === "today" ? "Sales today" : range === "week" ? "Sales this week" : "Sales this month"}
            description={range === "today" ? "By hour, completed orders" : "By day, completed orders"}
            action={
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: "today", label: "Today" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
              />
            }
          >
            {(() => {
              const series = range === "today" ? d.sales_today : range === "week" ? d.sales_week : d.sales_month;
              const points = trimHourly(series);
              const total = points.reduce((s, p) => s + p.sales, 0);
              return total > 0 ? (
                <SalesBarChart points={points} />
              ) : (
                <EmptyState icon={BarChart3} title="No sales in this period" description="Completed orders will appear here." className="h-[260px]" />
              );
            })()}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Top selling items" description="This month, by quantity">
              {d.top_items.length ? (
                <RankedBars
                  color="var(--chart-1)"
                  rows={d.top_items.map((i) => ({
                    key: i.menu_item_id,
                    label: i.name,
                    sub: i.category ?? undefined,
                    value: i.quantity,
                    valueLabel: `${i.quantity} sold`,
                  }))}
                />
              ) : (
                <EmptyState title="No items sold yet" className="py-8" />
              )}
            </ChartCard>
            <ChartCard title="Top categories" description="This month, by revenue">
              {d.top_categories.length ? (
                <RankedBars
                  color="var(--chart-2)"
                  rows={d.top_categories.map((c) => ({ key: c.name, label: c.name, value: c.revenue, valueLabel: formatCurrency(c.revenue) }))}
                />
              ) : (
                <EmptyState title="No category sales yet" className="py-8" />
              )}
            </ChartCard>
            <ChartCard title="Payment methods" description="This month, amount collected">
              {d.payment_methods.some((p) => p.amount > 0) ? (
                (() => {
                  const total = d.payment_methods.reduce((s, p) => s + p.amount, 0);
                  return (
                    <RankedBars
                      color="var(--chart-3)"
                      rows={[...d.payment_methods]
                        .filter((p) => p.count > 0)
                        .sort((a, b) => b.amount - a.amount)
                        .map((p) => ({
                          key: p.method,
                          label: humanize(p.method),
                          sub: `${p.count} payments`,
                          value: p.amount,
                          valueLabel: (
                            <>
                              {formatCurrency(p.amount)} <span className="text-xs text-muted-foreground">({((p.amount / total) * 100).toFixed(0)}%)</span>
                            </>
                          ),
                        }))}
                    />
                  );
                })()
              ) : (
                <EmptyState title="No payments yet" className="py-8" />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              className="lg:col-span-3"
              title="Recent orders"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/orders">
                    View all <ArrowRight />
                  </Link>
                </Button>
              }
            >
              {d.recent_orders.length ? (
                <ul className="-mx-2 divide-y divide-border">
                  {d.recent_orders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-primary">{o.table_number}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{o.order_number}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {o.table_name} · {o.item_count} items · {o.created_by_name} · {timeAgo(o.created_at)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-medium tabular-nums">{formatCurrency(o.grand_total)}</span>
                          <OrderStatusBadge status={o.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={ClipboardList} title="No active orders" description="Orders will show up here as soon as they are placed." className="py-8" />
              )}
            </ChartCard>

            <ChartCard
              className="lg:col-span-2"
              title="Low-stock alerts"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/inventory">
                    Inventory <ArrowRight />
                  </Link>
                </Button>
              }
            >
              {d.low_stock_items.length ? (
                <ul className="space-y-2">
                  {d.low_stock_items.map((i) => (
                    <li key={i.id}>
                      <Link href="/admin/inventory" className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-muted/60">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                          <Package className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{i.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {formatQty(i.current_quantity)} {i.unit} left · min {formatQty(i.minimum_quantity)} {i.unit}
                          </div>
                        </div>
                        <StockStatusBadge status={i.stock_status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Package} title="No low-stock items" description="Every ingredient is above its minimum level." className="py-8" />
              )}
            </ChartCard>
          </div>
        </>
      )}
    </PageContainer>
  );
}
