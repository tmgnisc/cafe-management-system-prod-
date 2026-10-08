"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, assetUrl, errorMessage, type MenuItemInput } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatCurrency } from "@/lib/currency";
import type { Category, MenuItem } from "@/types";

const money = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter a valid amount");

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  category_id: z.string().min(1, "Choose a category"),
  description: z.string().max(500).optional(),
  image: z.string().nullable(),
  selling_price: money,
  cost_price: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a valid amount"),
  is_available: z.boolean(),
  track_inventory: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = ["name", "sku", "category_id", "description", "image", "selling_price", "cost_price"];

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: MenuItem | null;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: blank(),
  });
  const { register, handleSubmit, control, reset, setError, setValue, formState } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            name: item.name,
            sku: item.sku,
            category_id: String(item.category_id),
            description: item.description ?? "",
            image: item.image,
            selling_price: String(item.selling_price),
            cost_price: String(item.cost_price ?? ""),
            is_available: item.is_available,
            track_inventory: item.track_inventory,
          }
        : blank(),
    );
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (body: MenuItemInput) => (item ? api.updateMenuItem(item.id, body) : api.createMenuItem(body)),
    onSuccess: () => {
      toast.success(item ? "Menu item updated" : "Menu item created");
      qc.invalidateQueries({ queryKey: qk.menuAll });
      qc.invalidateQueries({ queryKey: qk.recipes });
      qc.invalidateQueries({ queryKey: qk.categoriesAll });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, FIELDS)) toast.error(errorMessage(err));
    },
  });

  const onSubmit = (v: FormValues) =>
    mutation.mutate({
      name: v.name,
      sku: v.sku.toUpperCase(),
      category_id: Number(v.category_id),
      description: v.description?.trim() || null,
      image: v.image,
      selling_price: Number(v.selling_price),
      cost_price: v.cost_price === "" ? 0 : Number(v.cost_price),
      is_available: v.is_available,
      track_inventory: v.track_inventory,
    });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      setValue("image", res.path, { shouldDirty: true });
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const [image, sellRaw, costRaw] = useWatch({ control, name: ["image", "selling_price", "cost_price"] });
  const sell = Number(sellRaw);
  const cost = Number(costRaw || 0);
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{item ? `Edit ${item.name}` : "New menu item"}</DialogTitle>
          <DialogDescription>Price changes apply to new orders only — past bills keep their original price.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-[180px_1fr]" noValidate>
          {/* Image */}
          <div className="space-y-2">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/60">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(image) ?? ""} alt="Menu item" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-8 text-primary/40" />
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {image ? "Replace" : "Upload"}
              </Button>
              {image && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setValue("image", null, { shouldDirty: true })} aria-label="Remove image">
                  <X />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · max 2 MB</p>
            {formState.errors.image?.message && <p className="text-xs text-destructive">{formState.errors.image.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="mi-name" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input id="mi-name" {...register("name")} aria-invalid={!!formState.errors.name} placeholder="Cappuccino" />
            </FormField>
            <FormField label="SKU" htmlFor="mi-sku" required error={formState.errors.sku?.message}>
              <Input id="mi-sku" {...register("sku")} className="uppercase" placeholder="COF-CAP" aria-invalid={!!formState.errors.sku} />
            </FormField>
            <FormField label="Category" required error={formState.errors.category_id?.message}>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-invalid={!!formState.errors.category_id}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                          {!c.is_active && " (inactive)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Selling price (Rs.)" htmlFor="mi-sell" required error={formState.errors.selling_price?.message}>
              <Input
                id="mi-sell"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register("selling_price")}
                aria-invalid={!!formState.errors.selling_price}
              />
            </FormField>
            <FormField
              label="Cost price (Rs.)"
              htmlFor="mi-cost"
              error={formState.errors.cost_price?.message}
              hint={margin !== null && Number.isFinite(margin) ? `Margin ${margin.toFixed(0)}% · ${formatCurrency(sell - cost)} per serving` : undefined}
            >
              <Input id="mi-cost" type="number" step="0.01" min="0" inputMode="decimal" {...register("cost_price")} />
            </FormField>
            <FormField label="Description" htmlFor="mi-desc" error={formState.errors.description?.message} className="sm:col-span-2">
              <Textarea id="mi-desc" rows={2} {...register("description")} placeholder="Short description shown to staff" />
            </FormField>
            <Controller
              control={control}
              name="is_available"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium">Available</span>
                    <span className="block text-xs text-muted-foreground">Shown on the POS</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <Controller
              control={control}
              name="track_inventory"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium">Track inventory</span>
                    <span className="block text-xs text-muted-foreground">Deduct recipe on sale</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {item ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blank(): FormValues {
  return {
    name: "",
    sku: "",
    category_id: "",
    description: "",
    image: null,
    selling_price: "",
    cost_price: "",
    is_available: true,
    track_inventory: false,
  };
}
