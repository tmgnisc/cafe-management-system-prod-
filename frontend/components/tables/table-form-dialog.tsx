"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { CafeTable } from "@/types";

const schema = z.object({
  table_number: z
    .string()
    .trim()
    .min(1, "Table number is required")
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  name: z.string().trim().max(50).optional(),
  capacity: z.coerce.number<number>().int("Whole number").min(1, "At least 1 seat").max(50, "At most 50 seats"),
  section: z.string().trim().min(1, "Section is required").max(50),
});
type Values = z.infer<typeof schema>;

const DEFAULT_SECTIONS = ["Indoor", "Outdoor", "Window", "Garden", "Rooftop"];

export function TableFormDialog({
  open,
  onOpenChange,
  table,
  sections,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  table: CafeTable | null;
  sections: string[];
}) {
  const editing = !!table;
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setError, setValue, control, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { table_number: "", name: "", capacity: 2, section: "Indoor" },
  });
  const { errors } = formState;
  const section = useWatch({ control, name: "section" });
  const number = useWatch({ control, name: "table_number" });
  const allSections = Array.from(new Set([...sections, ...DEFAULT_SECTIONS]));

  useEffect(() => {
    if (open) {
      reset({
        table_number: table?.table_number ?? "",
        name: table?.name ?? "",
        capacity: table?.capacity ?? 2,
        section: table?.section ?? "Indoor",
      });
    }
  }, [open, table, reset]);

  const mutation = useMutation({
    mutationFn: (v: Values) => {
      const body = { table_number: v.table_number, name: v.name || null, capacity: v.capacity, section: v.section };
      return editing ? api.updateTable(table!.id, body) : api.createTable(body);
    },
    onSuccess: (t) => {
      toast.success(editing ? `${t.name} updated` : `${t.name} created`);
      qc.invalidateQueries({ queryKey: qk.tablesAll });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["table_number", "name", "capacity", "section"])) toast.error(errorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editing ? `Edit ${table?.name}` : "New table"}</DialogTitle>
          <DialogDescription>Tables appear on the POS floor plan for staff.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Table number" htmlFor="table_number" required error={errors.table_number?.message}>
              <Input id="table_number" placeholder="09" {...register("table_number")} aria-invalid={!!errors.table_number} />
            </FormField>
            <FormField label="Seats" htmlFor="capacity" required error={errors.capacity?.message}>
              <Input id="capacity" type="number" min={1} max={50} {...register("capacity")} aria-invalid={!!errors.capacity} />
            </FormField>
          </div>
          <FormField label="Display name" htmlFor="name" error={errors.name?.message} hint={`Leave blank for "Table ${number || "…"}"`}>
            <Input id="name" placeholder={`Table ${number || "09"}`} {...register("name")} />
          </FormField>
          <FormField label="Section" htmlFor="section" required error={errors.section?.message}>
            <Input id="section" list="table-sections" {...register("section")} aria-invalid={!!errors.section} />
            <datalist id="table-sections">
              {allSections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allSections.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue("section", s, { shouldValidate: true })}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    section === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
