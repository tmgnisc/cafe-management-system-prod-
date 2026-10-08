"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, MoreHorizontal, Package, PackageX, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Pill, StockStatusBadge } from "@/components/shared/status-badges";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { cn, formatQty } from "@/lib/utils";
import type { InventoryItem, StockStatus } from "@/types";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { InventoryDialog } from "./inventory-dialog";
import { MovementHistorySheet } from "./movement-history-sheet";

export function StockTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockStatus | "all">("all");
  const [inactive, setInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);
  const [deactivating, setDeactivating] = useState<InventoryItem | null>(null);
  const debounced = useDebounce(search);

  const filters = { search: debounced, status: status === "all" ? undefined : status, include_inactive: inactive, page, per_page: 20 };
  const query = useQuery({ queryKey: qk.inventory(filters), queryFn: () => api.getInventory(filters), placeholderData: keepPreviousData });
  const low = useQuery({ queryKey: qk.inventory({ status: "LOW_STOCK", per_page: 1 }), queryFn: () => api.getInventory({ status: "LOW_STOCK", per_page: 1 }) });
  const out = useQuery({
    queryKey: qk.inventory({ status: "OUT_OF_STOCK", per_page: 1 }),
    queryFn: () => api.getInventory({ status: "OUT_OF_STOCK", per_page: 1 }),
  });

  const deactivate = useMutation({
    mutationFn: (i: InventoryItem) => api.deleteInventoryItem(i.id),
    onSuccess: (i) => {
      toast.success(`${i.name} deactivated`);
      for (const key of [qk.inventoryAll, qk.inventoryOptions, qk.dashboard]) qc.invalidateQueries({ queryKey: key });
      setDeactivating(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDeactivating(null);
    },
  });
  const reactivate = useMutation({
    mutationFn: (i: InventoryItem) => api.updateInventoryItem(i.id, { is_active: true }),
    onSuccess: (i) => {
      toast.success(`${i.name} reactivated`);
      for (const key of [qk.inventoryAll, qk.inventoryOptions, qk.dashboard]) qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pickStatus = (s: StockStatus | "all") => {
    setStatus((cur) => (cur === s ? "all" : s));
    setPage(1);
  };

  const lowCount = low.data?.pagination.total ?? 0;
  const outCount = out.data?.pagination.total ?? 0;

  const actions = (i: InventoryItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!i.is_active} onClick={() => setAdjusting(i)}>
          <SlidersHorizontal /> Adjust stock
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setHistory(i)}>
          <History /> Movement history
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setEditing(i);
            setFormOpen(true);
          }}
        >
          <Pencil /> Edit details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {i.is_active ? (
          <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(i)}>
            <Trash2 /> Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => reactivate.mutate(i)}>
            <Package /> Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pickStatus("LOW_STOCK")}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
            status === "LOW_STOCK" ? "border-warning bg-warning-soft" : "border-border bg-card hover:bg-muted",
          )}
        >
          <AlertTriangle className="size-4 text-warning" />
          <span className="font-semibold tabular-nums">{lowCount}</span> low stock
        </button>
        <button
          type="button"
          onClick={() => pickStatus("OUT_OF_STOCK")}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
            status === "OUT_OF_STOCK" ? "border-destructive bg-danger-soft" : "border-border bg-card hover:bg-muted",
          )}
        >
          <PackageX className="size-4 text-destructive" />
          <span className="font-semibold tabular-nums">{outCount}</span> out of stock
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, SKU or supplier…"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StockStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="IN_STOCK">In stock</SelectItem>
              <SelectItem value="LOW_STOCK">Low stock</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={inactive}
              onCheckedChange={(v) => {
                setInactive(v);
                setPage(1);
              }}
            />
            Show inactive
          </label>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus /> New item
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingState rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        status === "LOW_STOCK" || status === "OUT_OF_STOCK" ? (
          <EmptyState
            icon={Package}
            title={status === "LOW_STOCK" ? "No low-stock items" : "Nothing is out of stock"}
            description="Everything is well stocked. Nice!"
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No inventory items"
            description={debounced ? "Try a different search." : "Add ingredients like coffee beans, milk and sugar."}
          />
        )
      ) : (
        <>
          <div className={cn("hidden overflow-hidden rounded-2xl border border-border bg-card md:block", query.isFetching && "opacity-70")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost / unit</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((i) => (
                  <TableRow key={i.id} className={cn(!i.is_active && "opacity-60")}>
                    <TableCell>
                      <button type="button" className="text-left" onClick={() => setHistory(i)}>
                        <div className="font-medium hover:underline">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{i.sku}</div>
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatQty(i.current_quantity)} <span className="text-muted-foreground">{i.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatQty(i.minimum_quantity)} {i.unit}
                    </TableCell>
                    <TableCell>{i.is_active ? <StockStatusBadge status={i.stock_status} /> : <Pill tone="gray">Inactive</Pill>}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(i.cost_per_unit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Math.max(0, i.current_quantity) * i.cost_per_unit)}</TableCell>
                    <TableCell className="max-w-44 truncate text-muted-foreground">{i.supplier ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" disabled={!i.is_active} onClick={() => setAdjusting(i)}>
                          Adjust
                        </Button>
                        {actions(i)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-2 md:hidden">
            {query.data.items.map((i) => (
              <li key={i.id} className={cn("rounded-xl border border-border bg-card p-3", !i.is_active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.sku} · {i.supplier ?? "No supplier"}
                    </p>
                  </div>
                  {actions(i)}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {formatQty(i.current_quantity)} <span className="text-sm font-normal text-muted-foreground">{i.unit}</span>
                  </span>
                  {i.is_active ? <StockStatusBadge status={i.stock_status} /> : <Pill tone="gray">Inactive</Pill>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Min {formatQty(i.minimum_quantity)} · {formatCurrency(i.cost_per_unit)}/{i.unit} · value{" "}
                  {formatCurrency(Math.max(0, i.current_quantity) * i.cost_per_unit)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination meta={query.data.pagination} onPageChange={setPage} />
        </>
      )}

      <InventoryDialog open={formOpen} onOpenChange={setFormOpen} item={editing} />
      <AdjustStockDialog item={adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
      <MovementHistorySheet item={history} onOpenChange={(o) => !o && setHistory(null)} />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name ?? "item"}?`}
        description="Inventory items are never deleted so their movement history is preserved. Items used in recipes must be removed from those recipes first."
        confirmLabel="Deactivate"
        destructive
        loading={deactivate.isPending}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
      />
    </div>
  );
}
