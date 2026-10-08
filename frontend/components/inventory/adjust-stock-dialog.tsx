"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, MinusCircle, PackagePlus, RotateCcw, SlidersHorizontal, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { api, ApiError, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { cn, formatQty } from "@/lib/utils";
import type { AdjustmentType, InventoryItem } from "@/types";

const TYPES: { value: AdjustmentType; label: string; hint: string; icon: typeof PackagePlus }[] = [
  { value: "PURCHASE", label: "Purchase", hint: "Stock received from a supplier", icon: PackagePlus },
  { value: "RETURN", label: "Return", hint: "Unused stock returned to the shelf", icon: RotateCcw },
  { value: "WASTE", label: "Waste", hint: "Spoiled, spilled or expired", icon: Trash },
  { value: "ADJUSTMENT", label: "Count correction", hint: "Fix after a physical count (+/−)", icon: SlidersHorizontal },
];

export function AdjustStockDialog({ item, onOpenChange }: { item: InventoryItem | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{item && <AdjustForm key={item.id} item={item} onOpenChange={onOpenChange} />}</DialogContent>
    </Dialog>
  );
}

function AdjustForm({ item, onOpenChange }: { item: InventoryItem; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<AdjustmentType>("PURCHASE");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const n = Number(qty);
  const valid = qty.trim() !== "" && Number.isFinite(n) && n > 0;
  const delta = !valid ? 0 : type === "WASTE" ? -n : type === "ADJUSTMENT" ? n * direction : n;
  const current = item.current_quantity;
  const next = Math.round((current + delta) * 1000) / 1000;
  const reasonRequired = type === "WASTE" || type === "ADJUSTMENT";

  const mutation = useMutation({
    mutationFn: () => api.adjustStock(item.id, { type, quantity: type === "ADJUSTMENT" ? n * direction : n, reason: reason.trim() || null }),
    onSuccess: (res) => {
      toast.success(`${res.name}: now ${formatQty(res.current_quantity)} ${res.unit}`);
      for (const key of [qk.inventoryAll, qk.inventoryOptions, qk.movementsAll, qk.dashboard]) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: qk.inventoryItem(res.id) });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]!])));
      }
      toast.error(errorMessage(err));
    },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!valid) e.quantity = "Enter a quantity greater than zero";
    if (reasonRequired && !reason.trim()) e.reason = "A reason is required for waste and corrections";
    if (valid && next < 0) e.quantity = "Stock cannot go below zero";
    setErrors(e);
    if (!Object.keys(e).length) mutation.mutate();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Adjust stock · {item.name}</DialogTitle>
        <DialogDescription>Every change is recorded as a stock movement.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
              type === t.value ? "border-primary bg-secondary ring-1 ring-primary/30" : "border-border bg-card hover:bg-muted",
            )}
          >
            <t.icon className={cn("mt-0.5 size-4 shrink-0", type === t.value ? "text-primary" : "text-muted-foreground")} />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {type === "ADJUSTMENT" && (
        <div className="flex gap-2">
          <Button type="button" variant={direction === 1 ? "default" : "outline"} size="sm" onClick={() => setDirection(1)}>
            <PackagePlus /> Add
          </Button>
          <Button type="button" variant={direction === -1 ? "default" : "outline"} size="sm" onClick={() => setDirection(-1)}>
            <MinusCircle /> Remove
          </Button>
        </div>
      )}

      <FormField label={`Quantity (${item.unit ?? ""})`} htmlFor="adj-qty" required error={errors.quantity}>
        <Input
          id="adj-qty"
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          autoFocus
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-invalid={!!errors.quantity}
        />
      </FormField>
      <FormField label="Reason" htmlFor="adj-reason" required={reasonRequired} error={errors.reason}>
        <Textarea
          id="adj-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={type === "PURCHASE" ? "e.g. Invoice #1234" : "What happened?"}
        />
      </FormField>

      <div className="flex items-center justify-between rounded-xl bg-secondary/70 px-4 py-3">
        <span className="text-sm text-muted-foreground">Stock after change</span>
        <span className="flex items-center gap-2 font-display text-lg font-semibold tabular-nums">
          <span className="text-muted-foreground">{formatQty(current)}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className={cn(next < 0 ? "text-destructive" : delta > 0 ? "text-success" : delta < 0 ? "text-warning" : "")}>{formatQty(next)}</span>
          <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
        </span>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Record movement
        </Button>
      </DialogFooter>
    </>
  );
}
