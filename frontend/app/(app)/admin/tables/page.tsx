"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MoreHorizontal, Pencil, Plus, Power, Receipt, Trash2, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { TableStatusBadge } from "@/components/shared/status-badges";
import { TableFormDialog } from "@/components/tables/table-form-dialog";
import { api, errorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { qk } from "@/lib/query-keys";
import { cn, humanize, timeAgo } from "@/lib/utils";
import type { CafeTable, TableStatus } from "@/types";

const STATUSES: TableStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "INACTIVE"];

export default function TablesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CafeTable | null>(null);
  const [deleting, setDeleting] = useState<CafeTable | null>(null);
  const [deactivating, setDeactivating] = useState<CafeTable | null>(null);

  const query = useQuery({
    queryKey: qk.tables({ include_inactive: true }),
    queryFn: () => api.getTables({ include_inactive: true }),
    refetchInterval: 30_000,
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const sections = useMemo(() => Array.from(new Set(all.map((t) => t.section))).sort(), [all]);

  const filtered = all.filter((t) => {
    const q = search.trim().toLowerCase();
    if (q && !`${t.name} ${t.table_number} ${t.section}`.toLowerCase().includes(q)) return false;
    if (section !== "all" && t.section !== section) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: all.filter((t) => t.status === s).length }), {});
  const seats = all.filter((t) => t.is_active).reduce((sum, t) => sum + t.capacity, 0);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.tablesAll });

  const setActive = useMutation({
    mutationFn: ({ table, active }: { table: CafeTable; active: boolean }) => api.updateTable(table.id, { is_active: active }),
    onSuccess: (t) => {
      toast.success(`${t.name} ${t.is_active ? "reactivated" : "deactivated"}`);
      setDeactivating(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (t: CafeTable) => api.deleteTable(t.id),
    onSuccess: (data, t) => {
      toast.success(data && "id" in data ? `${t.name} has order history and was deactivated instead of deleted` : `${t.name} deleted`);
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Tables"
        icon={UtensilsCrossed}
        description={`${all.filter((t) => t.is_active).length} active tables · ${seats} seats`}
        actions={
          <Button onClick={openCreate}>
            <Plus /> New table
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(status === s ? "all" : s)}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm transition-colors",
              status === s ? "border-primary ring-2 ring-primary/15" : "border-border hover:bg-muted",
            )}
          >
            <TableStatusBadge status={s} />
            <span className="font-semibold tabular-nums">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tables…" />
        <div className="flex gap-2">
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="h-9 w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-40 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {humanize(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState variant="cards" rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No tables found"
          description={all.length ? "No tables match these filters." : "Create your first table to start taking orders."}
          action={
            !all.length && (
              <Button variant="outline" onClick={openCreate}>
                <Plus /> New table
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group relative flex flex-col rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md",
                t.is_active ? "border-border" : "border-dashed border-border opacity-70",
                t.status === "OCCUPIED" && "border-primary/30 bg-secondary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{t.section}</div>
                  <div className="font-display text-xl font-semibold">{t.name}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(t);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    {t.is_active ? (
                      <DropdownMenuItem disabled={!!t.current_order_id} onClick={() => setDeactivating(t)}>
                        <Power /> Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setActive.mutate({ table: t, active: true })}>
                        <Power /> Reactivate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" disabled={!!t.current_order_id} onClick={() => setDeleting(t)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" /> {t.capacity} seats
                </span>
                <span>·</span>
                <span>#{t.table_number}</span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <TableStatusBadge status={t.status} />
                {!t.is_active && <span className="text-xs text-muted-foreground">Hidden from POS</span>}
              </div>

              {t.current_order_id && (
                <Link
                  href={`/orders/${t.current_order_id}`}
                  className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="size-4 text-primary" />
                    <span>
                      <span className="font-medium">{t.current_order_number}</span>
                      <span className="block text-xs text-muted-foreground">
                        <Clock className="mr-1 inline size-3" />
                        {timeAgo(t.current_order_started_at)} · {t.current_order_item_count} items
                      </span>
                    </span>
                  </span>
                  <span className="font-display font-semibold tabular-nums">{formatCurrency(t.current_order_total)}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <TableFormDialog open={formOpen} onOpenChange={setFormOpen} table={editing} sections={sections} />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name ?? "table"}?`}
        description="The table will be hidden from the POS. Its order history is kept and you can reactivate it at any time."
        confirmLabel="Deactivate"
        destructive
        loading={setActive.isPending}
        onConfirm={() => deactivating && setActive.mutate({ table: deactivating, active: false })}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "table"}?`}
        description="Tables with historical orders are never physically deleted — they are deactivated instead."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </PageContainer>
  );
}
