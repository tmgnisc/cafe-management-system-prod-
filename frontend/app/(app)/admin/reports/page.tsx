"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BarChart3, Download, Loader2, Printer, Receipt, Banknote, Percent, TrendingUp, Wallet } from "lucide-react";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { RoleBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartCard, RankedBars, SalesBarChart, trimHourly } from "@/components/dashboard/charts";
import { Segmented } from "@/components/dashboard/segmented";
import { downloadCsv, reportToCsv } from "@/components/reports/csv";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { humanize, todayISO } from "@/lib/utils";
import type { ReportPreset, SalesReport } from "@/types";

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

const HEADLINE_METHODS = ["CASH", "CARD", "ESEWA", "KHALTI"] as const;

function rangeLabel(from: string, to: string) {
  const f = parseISO(from);
  const t = parseISO(to);
  return from === to ? format(f, "EEEE, d MMM yyyy") : `${format(f, "d MMM yyyy")} – ${format(t, "d MMM yyyy")}`;
}

export default function ReportsPage() {
  const { data: settings } = useSettings();
  const [preset, setPreset] = useState<ReportPreset>("today");
  const [draftFrom, setDraftFrom] = useState(todayISO());
  const [draftTo, setDraftTo] = useState(todayISO());
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const params = preset === "custom" ? (custom ? { preset, ...custom } : null) : { preset };

  const query = useQuery<SalesReport>({
    queryKey: qk.salesReport(params ?? { preset: "custom-pending" }),
    queryFn: () => api.getSalesReport(params!),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  });

  const applyCustom = () => {
    if (!draftFrom || !draftTo) return setRangeError("Choose both a start and end date.");
    if (draftFrom > draftTo) return setRangeError("The start date must be on or before the end date.");
    setRangeError(null);
    setCustom({ from: draftFrom, to: draftTo });
  };

  const r = query.data;
  const cafeName = settings?.cafe_name ?? "Isha's Cozy Cafe";

  const exportCsv = () => {
    if (!r) return;
    downloadCsv(`sales-report_${r.range.from}_${r.range.to}.csv`, reportToCsv(r, cafeName));
  };

  return (
    <PageContainer className="report-print">
      {/* Page-scoped print styles: A4, print the whole report (global print CSS targets 80mm receipts). */}
      <style>{`@media print {
        @page { size: A4; margin: 12mm; }
        .report-print, .report-print * { visibility: visible; }
        .report-print { position: absolute; inset: 0 auto auto 0; width: 100%; max-width: none; padding: 0; }
        .report-print .recharts-responsive-container { break-inside: avoid; }
      }`}</style>
      <PageHeader
        title="Reports"
        icon={BarChart3}
        description={r ? rangeLabel(r.range.from, r.range.to) : "Sales, payments and performance"}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={!r}>
              <Printer /> Print
            </Button>
            <Button onClick={exportCsv} disabled={!r}>
              <Download /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Filters — one row above the charts */}
      <div className="no-print flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <Segmented value={preset} onChange={setPreset} options={PRESETS} ariaLabel="Report period" />
        {preset === "custom" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input id="from" type="date" value={draftFrom} max={todayISO()} onChange={(e) => setDraftFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input id="to" type="date" value={draftTo} max={todayISO()} onChange={(e) => setDraftTo(e.target.value)} className="h-9" />
            </div>
            <Button onClick={applyCustom} className="h-9">Apply</Button>
          </div>
        )}
      </div>
      {rangeError && <p className="text-sm font-medium text-destructive">{rangeError}</p>}

      {/* Printed header */}
      {r && (
        <div className="hidden print:block">
          <h2 className="font-display text-xl font-semibold">{cafeName} — Sales report</h2>
          <p className="text-sm">{rangeLabel(r.range.from, r.range.to)}</p>
        </div>
      )}

      {params === null ? (
        <EmptyState icon={BarChart3} title="Choose a date range" description="Pick a start and end date, then apply." />
      ) : query.isLoading ? (
        <>
          <LoadingState variant="cards" rows={8} />
          <LoadingState rows={6} />
        </>
      ) : query.isError || !r ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={query.isFetching ? "relative space-y-6 opacity-70 transition-opacity" : "space-y-6"}>
          {query.isFetching && <Loader2 className="absolute top-2 right-2 size-5 animate-spin text-muted-foreground" />}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Gross sales" value={formatCurrency(r.summary.gross_sales)} icon={Banknote} hint="Before discounts" />
            <StatCard label="Discount" value={formatCurrency(r.summary.discount)} icon={Percent} accent="amber" hint={r.summary.gross_sales ? `${((r.summary.discount / r.summary.gross_sales) * 100).toFixed(1)}% of gross` : undefined} />
            <StatCard label="Net sales" value={formatCurrency(r.summary.net_sales)} icon={TrendingUp} accent="green" hint={`Gross profit ${formatCurrency(r.summary.gross_profit)}`} />
            <StatCard label="Total collected" value={formatCurrency(r.summary.total_collected)} icon={Wallet} accent="caramel"
              hint={r.summary.tax || r.summary.service_charge ? `incl. ${formatCurrency(r.summary.service_charge)} service · ${formatCurrency(r.summary.tax)} tax` : "Net + service charge + tax"} />
            <StatCard label="Orders" value={r.summary.orders} icon={Receipt} accent="blue" hint={`${r.summary.items_sold} items · ${r.summary.cancelled_orders} cancelled`} />
            <StatCard label="Avg. order value" value={formatCurrency(r.summary.average_order_value)} icon={TrendingUp} accent="brown" />
            {HEADLINE_METHODS.slice(0, 2).map((m) => {
              const p = r.payment_methods.find((x) => x.method === m);
              return <StatCard key={m} label={`${humanize(m)} sales`} value={formatCurrency(p?.amount ?? 0)} hint={`${p?.count ?? 0} payments`} />;
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {HEADLINE_METHODS.slice(2).map((m) => {
              const p = r.payment_methods.find((x) => x.method === m);
              return <StatCard key={m} label={`${humanize(m)} sales`} value={formatCurrency(p?.amount ?? 0)} hint={`${p?.count ?? 0} payments`} />;
            })}
            {r.payment_methods
              .filter((p) => !HEADLINE_METHODS.includes(p.method as (typeof HEADLINE_METHODS)[number]))
              .map((p) => (
                <StatCard key={p.method} label={`${humanize(p.method)}`} value={formatCurrency(p.amount)} hint={`${p.count} payments`} />
              ))}
          </div>

          {r.summary.orders === 0 ? (
            <EmptyState icon={BarChart3} title="No sales in this period" description="There are no completed orders in the selected range." />
          ) : (
            <>
              <ChartCard title="Sales trend" description={r.series.granularity === "hour" ? "By hour" : "By day"}>
                <SalesBarChart points={trimHourly(r.series)} height={280} />
              </ChartCard>

              <div className="grid gap-4 lg:grid-cols-5">
                <ChartCard className="lg:col-span-3" title="Top-selling items" description="By quantity sold">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="hidden sm:table-cell">Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.top_items.map((i, idx) => (
                        <TableRow key={`${i.menu_item_id}-${i.name}`}>
                          <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{i.name}</TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">{i.category ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(i.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
                <ChartCard className="lg:col-span-2" title="Top categories" description="By revenue">
                  <RankedBars
                    color="var(--chart-2)"
                    rows={r.top_categories.map((c) => ({ key: c.name, label: c.name, sub: `${c.quantity} items`, value: c.revenue, valueLabel: formatCurrency(c.revenue) }))}
                  />
                </ChartCard>
              </div>

              <ChartCard title="Payment methods" description="Amount collected by method">
                <RankedBars
                  color="var(--chart-3)"
                  rows={[...r.payment_methods]
                    .filter((p) => p.count > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .map((p) => ({ key: p.method, label: humanize(p.method), sub: `${p.count} payments`, value: p.amount, valueLabel: formatCurrency(p.amount) }))}
                />
              </ChartCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Staff performance" description="Completed orders taken by each team member">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Discounts</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.staff_performance.map((s) => (
                        <TableRow key={s.user_id}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{s.name}</span>
                              <RoleBadge role={s.role} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.orders}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(s.sales)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(s.discounts)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(s.average_order_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
                <ChartCard title="Table performance" description="Revenue and average visit length per table">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Avg time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.table_performance.map((t) => (
                        <TableRow key={t.table_id}>
                          <TableCell>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.section} · {t.capacity} seats
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{t.orders}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(t.sales)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(t.average_order_value)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums sm:table-cell">{Math.round(t.average_minutes)} min</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartCard>
              </div>
            </>
          )}
        </div>
      )}
    </PageContainer>
  );
}
