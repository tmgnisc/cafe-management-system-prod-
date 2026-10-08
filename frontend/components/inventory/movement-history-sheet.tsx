"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StockStatusBadge } from "@/components/shared/status-badges";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatQty, humanize } from "@/lib/utils";
import type { InventoryItem, MovementType } from "@/types";
import { MovementsTable } from "./movements-table";

const TYPES: MovementType[] = ["INITIAL_STOCK", "PURCHASE", "SALE", "ADJUSTMENT", "WASTE", "RETURN"];

export function MovementHistorySheet({ item, onOpenChange }: { item: InventoryItem | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-3xl">{item && <ItemHistory key={item.id} item={item} />}</SheetContent>
    </Sheet>
  );
}

function ItemHistory({ item }: { item: InventoryItem }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("all");

  const filters = { item: item.id, page, per_page: 20, type: type === "all" ? undefined : type };
  const query = useQuery({
    queryKey: qk.movements(filters),
    queryFn: () => api.getItemMovements(item.id, { page, per_page: 20, type: filters.type }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <SheetHeader className="border-b border-border">
        <SheetTitle className="font-display text-xl">{item.name} · stock history</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              On hand{" "}
              <span className="font-medium text-foreground">
                {formatQty(item.current_quantity)} {item.unit}
              </span>{" "}
              · min {formatQty(item.minimum_quantity)}
            </span>
            <StockStatusBadge status={item.stock_status} />
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All movement types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {query.isLoading ? (
          <LoadingState rows={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !query.data?.items.length ? (
          <EmptyState icon={History} title="No stock movements" description="Purchases, sales and adjustments will appear here." />
        ) : (
          <>
            <MovementsTable movements={query.data.items} showItem={false} />
            <Pagination meta={query.data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}
