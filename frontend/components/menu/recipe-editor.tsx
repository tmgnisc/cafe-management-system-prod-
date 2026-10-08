"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { formatQty } from "@/lib/utils";
import type { InventoryOption, InventoryUnit, MenuItem } from "@/types";
import { compatibleUnits, convertQty, defaultRecipeUnit } from "./units";

interface Row {
  key: number;
  inventory_item_id: string;
  quantity: string;
  unit: InventoryUnit | "";
}

let rowKey = 0;
const newRow = (): Row => ({ key: ++rowKey, inventory_item_id: "", quantity: "", unit: "" });

export function RecipeEditor({ menuItemId, open, onOpenChange }: { menuItemId: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        {open && menuItemId !== null && <RecipeLoader key={menuItemId} menuItemId={menuItemId} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}

function RecipeLoader({ menuItemId, onOpenChange }: { menuItemId: number; onOpenChange: (o: boolean) => void }) {
  const item = useQuery({ queryKey: qk.menuItem(menuItemId), queryFn: () => api.getMenuItem(menuItemId), staleTime: 0 });
  const inventory = useQuery({
    queryKey: qk.inventoryOptions,
    queryFn: api.getInventoryOptions,
  });

  if (item.isLoading || inventory.isLoading || item.isError || inventory.isError || !item.data || !inventory.data) {
    return (
      <>
        <SheetHeader className="border-b border-border">
          <SheetTitle className="font-display text-xl">Recipe</SheetTitle>
          <SheetDescription>Loading ingredients…</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {item.isError || inventory.isError ? (
            <ErrorState error={item.error ?? inventory.error} onRetry={() => (item.refetch(), inventory.refetch())} />
          ) : (
            <LoadingState rows={4} />
          )}
        </div>
      </>
    );
  }
  return <RecipeForm key={item.dataUpdatedAt} item={item.data} inventory={inventory.data} onOpenChange={onOpenChange} />;
}

function RecipeForm({ item, inventory, onOpenChange }: { item: MenuItem; inventory: InventoryOption[]; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const menuItemId = item.id;
  const initial = item.recipe?.items ?? [];
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length
      ? initial.map((i) => ({ key: ++rowKey, inventory_item_id: String(i.inventory_item_id), quantity: String(i.quantity), unit: i.unit }))
      : [newRow()],
  );
  const [track, setTrack] = useState(item.track_inventory || initial.length === 0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invById = useMemo(() => {
    const m = new Map<number, InventoryOption>();
    inventory.forEach((i) => m.set(i.id, i));
    return m;
  }, [inventory]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const costPerServing = rows.reduce((sum, r) => {
    const inv = invById.get(Number(r.inventory_item_id));
    const q = Number(r.quantity);
    if (!inv || !r.unit || !(q > 0)) return sum;
    const inInvUnit = convertQty(q, r.unit, inv.unit);
    return Number.isFinite(inInvUnit) ? sum + inInvUnit * inv.cost_per_unit : sum;
  }, 0);

  const save = useMutation({
    mutationFn: () => {
      const local: Record<string, string> = {};
      const filled = rows.filter((r) => r.inventory_item_id || r.quantity);
      const seen = new Set<string>();
      filled.forEach((r, i) => {
        if (!r.inventory_item_id) local[`items.${i}.inventory_item_id`] = "Choose an ingredient";
        else if (seen.has(r.inventory_item_id)) local[`items.${i}.inventory_item_id`] = "Ingredient listed twice";
        seen.add(r.inventory_item_id);
        if (!(Number(r.quantity) > 0)) local[`items.${i}.quantity`] = "Enter a quantity";
        if (!r.unit) local[`items.${i}.unit`] = "Unit";
      });
      if (Object.keys(local).length) {
        // Re-map indices to the visible rows.
        setErrors(remap(local, filled, rows));
        return Promise.reject(new Error("Please fix the highlighted rows"));
      }
      setErrors({});
      return api.saveRecipe(
        menuItemId,
        filled.map((r) => ({ inventory_item_id: Number(r.inventory_item_id), quantity: Number(r.quantity), unit: r.unit as InventoryUnit })),
        track,
      );
    },
    onSuccess: () => {
      toast.success("Recipe saved");
      qc.invalidateQueries({ queryKey: qk.recipes });
      qc.invalidateQueries({ queryKey: qk.menuAll });
      qc.invalidateQueries({ queryKey: qk.menuItem(menuItemId) });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        const filled = rows.filter((r) => r.inventory_item_id || r.quantity);
        const flat: Record<string, string> = {};
        Object.entries(err.errors).forEach(([k, v]) => (flat[k] = v[0]!));
        setErrors(remap(flat, filled, rows));
      }
      toast.error(errorMessage(err));
    },
  });

  return (
    <>
      <SheetHeader className="border-b border-border">
        <SheetTitle className="font-display text-xl">Recipe · {item.name}</SheetTitle>
        <SheetDescription>Ingredients used for ONE serving. They are deducted from stock automatically when an order is paid.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {
          <>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium">Track inventory</span>
                <span className="block text-xs text-muted-foreground">Deduct these ingredients on every sale</span>
              </span>
              <Switch checked={track} onCheckedChange={setTrack} />
            </label>

            <div className="hidden grid-cols-[1fr_96px_96px_32px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ingredient</span>
              <span>Qty</span>
              <span>Unit</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const inv = invById.get(Number(r.inventory_item_id));
              const units = inv ? compatibleUnits(inv.unit) : [];
              const e = (f: string) => errors[`items.${i}.${f}`];
              return (
                <div key={r.key} className="rounded-xl border border-border bg-card p-2 sm:border-0 sm:bg-transparent sm:p-0">
                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_96px_96px_32px]">
                    <Select
                      value={r.inventory_item_id}
                      onValueChange={(v) => {
                        const next = invById.get(Number(v));
                        update(r.key, { inventory_item_id: v, unit: next ? defaultRecipeUnit(next.unit) : "" });
                      }}
                    >
                      <SelectTrigger className="col-span-2 w-full bg-card sm:col-span-1" aria-invalid={!!e("inventory_item_id")}>
                        <SelectValue placeholder="Choose ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}{" "}
                            <span className="text-muted-foreground">
                              ({formatQty(o.current_quantity)} {o.unit})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="col-span-2 grid grid-cols-[1fr_1fr_32px] gap-2 sm:contents">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        inputMode="decimal"
                        className="bg-card"
                        value={r.quantity}
                        placeholder="18"
                        aria-label="Quantity"
                        aria-invalid={!!e("quantity")}
                        onChange={(ev) => update(r.key, { quantity: ev.target.value })}
                      />
                      <Select value={r.unit} onValueChange={(v) => update(r.key, { unit: v as InventoryUnit })} disabled={!inv}>
                        <SelectTrigger className="w-full bg-card" aria-invalid={!!e("unit")} aria-label="Unit">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="Remove ingredient"
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {(e("inventory_item_id") || e("quantity") || e("unit")) && (
                    <p className="mt-1 text-xs text-destructive">{e("inventory_item_id") ?? e("quantity") ?? e("unit")}</p>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
              <Plus /> Add ingredient
            </Button>
          </>
        }
      </div>

      <SheetFooter className="border-t border-border bg-secondary/40">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated ingredient cost / serving</span>
          <span className="font-display text-lg font-semibold tabular-nums">{formatCurrency(costPerServing)}</span>
        </div>
        {item.selling_price > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            Sells for {formatCurrency(item.selling_price)} · food cost {((costPerServing / item.selling_price) * 100).toFixed(0)}%
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save recipe
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

/** Errors are keyed by index among *filled* rows; translate them to visible row indices. */
function remap(errs: Record<string, string>, filled: Row[], all: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errs)) {
    const m = /^items\.(\d+)\.(.+)$/.exec(k);
    if (!m) continue;
    const row = filled[Number(m[1])];
    const idx = row ? all.findIndex((r) => r.key === row.key) : -1;
    if (idx >= 0) out[`items.${idx}.${m[2]}`] = v;
  }
  return out;
}
