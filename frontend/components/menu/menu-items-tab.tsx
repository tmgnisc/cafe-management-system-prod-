"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Coffee, Pencil, Plus, Trash2, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Pill } from "@/components/shared/status-badges";
import { useDebounce } from "@/hooks/use-debounce";
import { api, assetUrl, errorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types";
import { MenuItemDialog } from "./menu-item-dialog";

export function MenuItemsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const debounced = useDebounce(search);

  const filters = {
    search: debounced,
    category_id: category === "all" ? undefined : Number(category),
    available: availability === "all" ? ("" as const) : availability === "yes",
    include_archived: archived,
    page,
    per_page: 24,
  };

  const categories = useQuery({ queryKey: qk.categories({ include_inactive: true }), queryFn: () => api.getCategories({ include_inactive: true }) });
  const items = useQuery({ queryKey: qk.menu(filters), queryFn: () => api.getMenuItems(filters), placeholderData: keepPreviousData });

  const toggle = useMutation({
    mutationFn: (m: MenuItem) => api.updateMenuItem(m.id, { is_available: !m.is_available }),
    onSuccess: (m) => {
      toast.success(`${m.name} is now ${m.is_available ? "available" : "unavailable"}`);
      qc.invalidateQueries({ queryKey: qk.menuAll });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (m: MenuItem) => api.deleteMenuItem(m.id),
    onSuccess: (res) => {
      toast.success(res ? "Item has order history — archived instead of deleted" : "Menu item deleted");
      qc.invalidateQueries({ queryKey: qk.menuAll });
      qc.invalidateQueries({ queryKey: qk.recipes });
      qc.invalidateQueries({ queryKey: qk.categoriesAll });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search name or SKU…" />
          <Select value={category} onValueChange={resetPage(setCategory)}>
            <SelectTrigger className="h-9 w-44 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.data?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={availability} onValueChange={resetPage(setAvailability)}>
            <SelectTrigger className="h-9 w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              <SelectItem value="yes">Available</SelectItem>
              <SelectItem value="no">Unavailable</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={archived} onCheckedChange={resetPage(setArchived)} /> Show archived
          </label>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> New item
        </Button>
      </div>

      {items.isLoading ? (
        <LoadingState variant="cards" rows={8} />
      ) : items.isError ? (
        <ErrorState error={items.error} onRetry={() => items.refetch()} />
      ) : !items.data?.items.length ? (
        <EmptyState
          icon={Coffee}
          title="No menu items found"
          description={debounced || category !== "all" ? "Try a different search or filter." : "Add your first item to start selling."}
        />
      ) : (
        <>
          <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", items.isFetching && "opacity-70 transition-opacity")}>
            {items.data.items.map((m) => {
              const margin = m.selling_price > 0 ? ((m.selling_price - m.cost_price) / m.selling_price) * 100 : 0;
              return (
                <div key={m.id} className={cn("flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm", !m.is_active && "opacity-60")}>
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(m.image) ?? ""} alt={m.name} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center font-display text-2xl text-primary/50">{m.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.sku} · {m.category_name}
                        </p>
                      </div>
                      <p className="shrink-0 font-display text-lg font-semibold tabular-nums">{formatCurrency(m.selling_price)}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        Cost {formatCurrency(m.cost_price)} · <span className={margin < 40 ? "text-warning" : "text-success"}>{margin.toFixed(0)}% margin</span>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!m.is_active && <Pill tone="gray">Archived</Pill>}
                      {m.track_inventory ? (
                        <Pill tone="caramel">
                          <Boxes className="size-3" /> {m.recipe_item_count} ingredient{m.recipe_item_count === 1 ? "" : "s"}
                        </Pill>
                      ) : (
                        <Pill tone="gray">Not tracked</Pill>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch size="sm" checked={m.is_available} disabled={!m.is_active || toggle.isPending} onCheckedChange={() => toggle.mutate(m)} />
                        {m.is_available ? "Available" : "Unavailable"}
                      </label>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${m.name}`}
                          onClick={() => {
                            setEditing(m);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        {m.is_active && (
                          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete ${m.name}`} onClick={() => setDeleting(m)}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination meta={items.data.pagination} onPageChange={setPage} />
        </>
      )}

      <MenuItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} categories={categories.data ?? []} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.name ?? "item"}?`}
        description={
          <>
            <Archive className="mr-1 inline size-3.5" />
            Items that appear on past orders are archived (hidden from the POS) instead of deleted, so history stays intact.
          </>
        }
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
