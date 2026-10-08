"use client";

/* eslint-disable @next/next/no-img-element -- menu images are served by the PHP API host */
import { Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/states";
import { assetUrl } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Category, MenuItem } from "@/types";

const TILE_TONES = [
  "from-[oklch(0.86_0.05_60)] to-[oklch(0.78_0.07_55)]",
  "from-[oklch(0.88_0.05_85)] to-[oklch(0.8_0.08_75)]",
  "from-[oklch(0.86_0.04_150)] to-[oklch(0.78_0.06_150)]",
  "from-[oklch(0.86_0.05_35)] to-[oklch(0.78_0.08_35)]",
  "from-[oklch(0.85_0.03_250)] to-[oklch(0.78_0.05_250)]",
];

export function CategoryRail({
  categories,
  active,
  onSelect,
  counts,
  orientation,
}: {
  categories: Category[];
  active: number | "all";
  onSelect: (id: number | "all") => void;
  counts: Record<number, number>;
  orientation: "vertical" | "horizontal";
}) {
  const all = [{ id: "all" as const, name: "All items", count: Object.values(counts).reduce((a, b) => a + b, 0) }, ...categories.map((c) => ({ id: c.id, name: c.name, count: counts[c.id] ?? 0 }))];
  return (
    <div
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1",
      )}
      role="tablist"
      aria-label="Menu categories"
    >
      {all.map((c) => {
        const selected = active === c.id;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 rounded-xl text-left text-sm font-medium transition-all",
              orientation === "vertical" ? "px-3.5 py-3" : "border px-4 py-2.5",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : orientation === "vertical"
                  ? "text-foreground/80 hover:bg-secondary"
                  : "border-border bg-card text-foreground/80 hover:bg-secondary",
            )}
          >
            <span className="truncate">{c.name}</span>
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MenuSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search menu or SKU…" className="h-11 rounded-xl bg-card pl-10 text-[0.95rem]" aria-label="Search menu" />
      {value && (
        <button onClick={() => onChange("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function MenuGrid({
  items,
  onAdd,
  inCart,
  disabled,
}: {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
  inCart: Record<number, number>;
  disabled?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState title="No menu items found" description="Try another category or search term." />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const qty = inCart[item.id] ?? 0;
        const img = assetUrl(item.image);
        return (
          <button
            key={item.id}
            onClick={() => onAdd(item)}
            disabled={disabled}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
              qty > 0 ? "border-primary/60 ring-2 ring-primary/15" : "border-border hover:border-primary/40 hover:shadow-md",
            )}
            aria-label={`Add ${item.name}, ${formatCurrency(item.selling_price)}`}
          >
            <div className={cn("relative flex h-20 items-center justify-center bg-gradient-to-br sm:h-24", TILE_TONES[item.category_id % TILE_TONES.length])}>
              {img ? (
                <img src={img} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
              ) : (
                <span className="font-display text-3xl font-semibold text-primary/70">{item.name.slice(0, 1)}</span>
              )}
              {qty > 0 && (
                <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-md tabular-nums">
                  {qty}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-1 p-3">
              <span className="line-clamp-2 text-sm leading-snug font-medium">{item.name}</span>
              <div className="flex items-center justify-between">
                <span className="font-semibold tabular-nums text-primary">{formatCurrency(item.selling_price)}</span>
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="size-4" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
