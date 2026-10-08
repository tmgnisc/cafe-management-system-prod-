"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { INVENTORY_UNITS, type InventoryItem, type InventoryUnit } from "@/types";

const nonNeg = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), msg);

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  unit: z.enum(INVENTORY_UNITS as [InventoryUnit, ...InventoryUnit[]], { message: "Choose a unit" }),
  current_quantity: nonNeg("Enter a valid quantity"),
  minimum_quantity: nonNeg("Enter a valid quantity"),
  cost_per_unit: nonNeg("Enter a valid amount"),
  supplier: z.string().max(150).optional(),
});
type FormValues = z.infer<typeof schema>;

const blank: FormValues = { name: "", sku: "", unit: "kg", current_quantity: "0", minimum_quantity: "0", cost_per_unit: "0", supplier: "" };

export function InventoryDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: InventoryItem | null }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, control, setError, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            current_quantity: String(item.current_quantity),
            minimum_quantity: String(item.minimum_quantity),
            cost_per_unit: String(item.cost_per_unit),
            supplier: item.supplier ?? "",
          }
        : blank,
    );
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const common = {
        name: v.name,
        sku: v.sku.toUpperCase(),
        unit: v.unit,
        minimum_quantity: Number(v.minimum_quantity || 0),
        cost_per_unit: Number(v.cost_per_unit || 0),
        supplier: v.supplier?.trim() || null,
      };
      return item ? api.updateInventoryItem(item.id, common) : api.createInventoryItem({ ...common, current_quantity: Number(v.current_quantity || 0) });
    },
    onSuccess: () => {
      toast.success(item ? "Inventory item updated" : "Inventory item created");
      for (const key of [qk.inventoryAll, qk.inventoryOptions, qk.movementsAll, qk.dashboard, qk.recipes]) qc.invalidateQueries({ queryKey: key });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["name", "sku", "unit", "current_quantity", "minimum_quantity", "cost_per_unit", "supplier"]))
        toast.error(errorMessage(err));
    },
  });

  const unit = useWatch({ control, name: "unit" });
  const e = formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{item ? `Edit ${item.name}` : "New inventory item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "To change the quantity on hand, use Adjust stock so the change is recorded."
              : "The opening quantity is recorded as an initial stock movement."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Name" htmlFor="inv-name" required error={e.name?.message} className="sm:col-span-2">
            <Input id="inv-name" {...register("name")} placeholder="Coffee Beans" aria-invalid={!!e.name} />
          </FormField>
          <FormField label="SKU" htmlFor="inv-sku" required error={e.sku?.message}>
            <Input id="inv-sku" {...register("sku")} className="uppercase" placeholder="INV-COF" aria-invalid={!!e.sku} />
          </FormField>
          <FormField label="Unit" required error={e.unit?.message} hint={item ? "Only changeable at zero stock when unused in recipes" : undefined}>
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-invalid={!!e.unit}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {!item && (
            <FormField label={`Opening quantity (${unit})`} htmlFor="inv-qty" error={e.current_quantity?.message}>
              <Input id="inv-qty" type="number" step="0.001" min="0" inputMode="decimal" {...register("current_quantity")} />
            </FormField>
          )}
          <FormField label={`Minimum level (${unit})`} htmlFor="inv-min" error={e.minimum_quantity?.message} hint="Low-stock alert threshold">
            <Input id="inv-min" type="number" step="0.001" min="0" inputMode="decimal" {...register("minimum_quantity")} />
          </FormField>
          <FormField label={`Cost per ${unit} (Rs.)`} htmlFor="inv-cost" error={e.cost_per_unit?.message}>
            <Input id="inv-cost" type="number" step="0.01" min="0" inputMode="decimal" {...register("cost_per_unit")} />
          </FormField>
          <FormField label="Supplier" htmlFor="inv-sup" error={e.supplier?.message} className={item ? "" : "sm:col-span-2"}>
            <Input id="inv-sup" {...register("supplier")} placeholder="Optional" />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {item ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
