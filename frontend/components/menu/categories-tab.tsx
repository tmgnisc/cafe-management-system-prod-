"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField, applyServerErrors } from "@/components/shared/form-field";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Pill } from "@/components/shared/status-badges";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage, type CategoryInput } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Category } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().max(255).optional(),
  sort_order: z.string().refine((v) => /^\d{1,4}$/.test(v.trim()), "Enter a number from 0 to 9999"),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function CategoryDialog({
  open,
  onOpenChange,
  category,
  nextSort,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: Category | null;
  nextSort: number;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, control, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", sort_order: "0", is_active: true },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      category
        ? { name: category.name, description: category.description ?? "", sort_order: String(category.sort_order), is_active: category.is_active }
        : { name: "", description: "", sort_order: String(nextSort), is_active: true },
    );
  }, [open, category, nextSort, reset]);

  const mutation = useMutation({
    mutationFn: (body: CategoryInput) => (category ? api.updateCategory(category.id, body) : api.createCategory(body)),
    onSuccess: () => {
      toast.success(category ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: qk.categoriesAll });
      qc.invalidateQueries({ queryKey: qk.menuAll });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyServerErrors(err, setError, ["name", "description", "sort_order"])) toast.error(errorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Categories group items on the POS menu.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) =>
            mutation.mutate({ name: v.name, description: v.description?.trim() || null, sort_order: Number(v.sort_order), is_active: v.is_active }),
          )}
        >
          <FormField label="Name" htmlFor="cat-name" required error={formState.errors.name?.message}>
            <Input id="cat-name" {...register("name")} placeholder="Coffee" aria-invalid={!!formState.errors.name} />
          </FormField>
          <FormField label="Description" htmlFor="cat-desc" error={formState.errors.description?.message}>
            <Textarea id="cat-desc" rows={2} {...register("description")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sort order" htmlFor="cat-sort" error={formState.errors.sort_order?.message}>
              <Input id="cat-sort" type="number" min="0" {...register("sort_order")} />
            </FormField>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <label className="mt-6 flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm font-medium">Active</span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {category ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const query = useQuery({
    queryKey: qk.categories({ include_inactive: true, search: debounced }),
    queryFn: () => api.getCategories({ include_inactive: true, search: debounced }),
  });

  const remove = useMutation({
    mutationFn: (c: Category) => api.deleteCategory(c.id),
    onSuccess: (res) => {
      toast.success(res ? "Category has menu items — deactivated instead" : "Category deleted");
      qc.invalidateQueries({ queryKey: qk.categoriesAll });
      qc.invalidateQueries({ queryKey: qk.menuAll });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = query.data ?? [];
  const nextSort = list.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" />
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> New category
        </Button>
      </div>

      {query.isLoading ? (
        <LoadingState rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={FolderOpen} title="No categories found" description="Create categories like Coffee, Tea or Desserts." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{c.sort_order}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.description && <div className="max-w-md truncate text-xs text-muted-foreground">{c.description}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.item_count}</TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Pill tone="green" dot>
                        Active
                      </Pill>
                    ) : (
                      <Pill tone="gray" dot>
                        Inactive
                      </Pill>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      {c.is_active && (
                        <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryDialog open={open} onOpenChange={setOpen} category={editing} nextSort={nextSort} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.name ?? "category"}?`}
        description="Categories that still contain menu items are deactivated instead of deleted."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
