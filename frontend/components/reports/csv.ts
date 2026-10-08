import { humanize } from "@/lib/utils";
import type { SalesReport } from "@/types";

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rows(data: (string | number | null | undefined)[][]): string {
  return data.map((r) => r.map(cell).join(",")).join("\n");
}

/** Build a CSV of the report (summary, payments, top items, categories, staff, tables). */
export function reportToCsv(r: SalesReport, cafeName: string): string {
  const s = r.summary;
  const parts = [
    rows([[`${cafeName} — Sales report`], ["From", r.range.from], ["To", r.range.to], []]),
    rows([
      ["Summary", "Value (NPR)"],
      ["Gross sales", s.gross_sales],
      ["Discount", s.discount],
      ["Net sales", s.net_sales],
      ["Service charge", s.service_charge],
      ["Tax", s.tax],
      ["Total collected", s.total_collected],
      ["Orders", s.orders],
      ["Items sold", s.items_sold],
      ["Cancelled orders", s.cancelled_orders],
      ["Average order value", s.average_order_value],
      ["Cost of goods", s.cost_of_goods],
      ["Gross profit", s.gross_profit],
      [],
    ]),
    rows([["Payment method", "Payments", "Amount (NPR)"], ...r.payment_methods.map((p) => [humanize(p.method), p.count, p.amount]), []]),
    rows([["Top items", "Category", "Quantity", "Revenue (NPR)"], ...r.top_items.map((i) => [i.name, i.category, i.quantity, i.revenue]), []]),
    rows([["Category", "Quantity", "Revenue (NPR)"], ...r.top_categories.map((c) => [c.name, c.quantity, c.revenue]), []]),
    rows([
      ["Staff", "Role", "Orders", "Sales (NPR)", "Discounts (NPR)", "Avg order (NPR)"],
      ...r.staff_performance.map((p) => [p.name, humanize(p.role), p.orders, p.sales, p.discounts, p.average_order_value]),
      [],
    ]),
    rows([
      ["Table", "Section", "Orders", "Sales (NPR)", "Avg order (NPR)", "Avg minutes"],
      ...r.table_performance.map((t) => [t.name, t.section, t.orders, t.sales, t.average_order_value, Math.round(t.average_minutes)]),
    ]),
  ];
  return parts.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
