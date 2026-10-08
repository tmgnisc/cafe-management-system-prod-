"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency, formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Series, SeriesPoint } from "@/types";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl border-border bg-card shadow-none", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="font-display text-lg font-semibold">{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Trim an hourly series to business hours (7 AM–10 PM), widened to include any hour with sales. */
export function trimHourly(series: Series): SeriesPoint[] {
  if (series.granularity !== "hour") return series.points;
  const withData = series.points.map((p, i) => (p.orders > 0 ? i : -1)).filter((i) => i >= 0);
  const start = Math.min(7, ...withData);
  const end = Math.max(22, ...withData);
  return series.points.slice(start, end + 1);
}

function SalesTooltip({ active, payload }: { active?: boolean; payload?: { payload: SeriesPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{p.label}</div>
      <div className="mt-1 tabular-nums text-foreground">{formatCurrency(p.sales)}</div>
      <div className="text-muted-foreground tabular-nums">
        {p.orders} order{p.orders === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Single-series sales bars (one hue, no legend — the card title names the series). */
export function SalesBarChart({ points, height = 260 }: { points: SeriesPoint[]; height?: number }) {
  const dense = points.length > 16;
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Sales chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={dense ? "18%" : "28%"}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            interval={dense ? "preserveStartEnd" : 0}
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => formatCompactCurrency(v)}
          />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.7 }} content={<SalesTooltip />} />
          <Bar dataKey="sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BarRow {
  key: string | number;
  label: ReactNode;
  value: number;
  valueLabel: ReactNode;
  sub?: ReactNode;
}

/** Ranked horizontal bars rendered in plain HTML — readable, accessible, labelled directly. */
export function RankedBars({ rows, color = "var(--chart-2)" }: { rows: BarRow[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.key} title={typeof r.label === "string" ? r.label : undefined}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="truncate font-medium text-foreground">{r.label}</span>
              {r.sub && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{r.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">{r.valueLabel}</span>
          </div>
          <div className="mt-1.5 ml-6 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
