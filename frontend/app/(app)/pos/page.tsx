"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, RefreshCw, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { TableCard } from "@/components/pos/table-card";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CafeTable, TableStatus } from "@/types";

const FILTERS: { value: TableStatus | "ALL"; label: string; dot: string }[] = [
  { value: "ALL", label: "All", dot: "bg-foreground/40" },
  { value: "AVAILABLE", label: "Available", dot: "bg-success" },
  { value: "OCCUPIED", label: "Occupied", dot: "bg-primary" },
  { value: "RESERVED", label: "Reserved", dot: "bg-info" },
  { value: "CLEANING", label: "Cleaning", dot: "bg-warning" },
];

export default function PosTablesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TableStatus | "ALL">("ALL");

  const tablesQuery = useQuery({
    queryKey: qk.tables(),
    queryFn: () => api.getTables(),
    refetchInterval: 15_000, // keep the floor view live across devices
  });

  const statusMutation = useMutation({
    mutationFn: ({ table, status }: { table: CafeTable; status: "AVAILABLE" | "RESERVED" | "CLEANING" }) => api.setTableStatus(table.id, status),
    onSuccess: (t) => {
      toast.success(`${t.name} marked ${t.status.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: qk.tablesAll });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tables.length };
    for (const t of tables) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tables]);
  const openValue = tables.reduce((s, t) => s + (t.current_order_total ?? 0), 0);

  const visible = filter === "ALL" ? tables : tables.filter((t) => t.status === filter);
  const sections = useMemo(() => {
    const map = new Map<string, CafeTable[]>();
    for (const t of visible) map.set(t.section, [...(map.get(t.section) ?? []), t]);
    return [...map.entries()];
  }, [visible]);

  return (
    <PageContainer>
      <PageHeader
        icon={LayoutGrid}
        title="Tables"
        description={
          <>
            Good {greeting()}, {user?.name.split(" ")[0]}. {counts.OCCUPIED ?? 0} occupied · {counts.AVAILABLE ?? 0} free
            {openValue > 0 && <> · {formatCurrency(openValue)} on open tabs</>}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => tablesQuery.refetch()} disabled={tablesQuery.isFetching}>
            <RefreshCw className={cn(tablesQuery.isFetching && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Filter tables by status">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              filter === f.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", filter === f.value ? "bg-primary-foreground" : f.dot)} />
            {f.label}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", filter === f.value ? "bg-primary-foreground/20" : "bg-muted")}>{counts[f.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {tablesQuery.isLoading ? (
        <LoadingState variant="cards" rows={8} />
      ) : tablesQuery.isError ? (
        <ErrorState error={tablesQuery.error} onRetry={() => tablesQuery.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No tables found"
          description={filter === "ALL" ? "Ask an administrator to add tables." : `No tables are currently ${filter.toLowerCase()}.`}
          action={filter !== "ALL" ? <Button variant="outline" size="sm" onClick={() => setFilter("ALL")}>Show all tables</Button> : undefined}
        />
      ) : (
        <div className="space-y-8">
          {sections.map(([section, list]) => (
            <section key={section}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {section} <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
                {list.map((t) => (
                  <TableCard key={t.id} table={t} onSetStatus={(table, status) => statusMutation.mutate({ table, status })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
