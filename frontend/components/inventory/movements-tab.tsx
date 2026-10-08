"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { humanize } from "@/lib/utils";
import type { MovementType } from "@/types";
import { MovementsTable } from "./movements-table";

const TYPES: MovementType[] = ["INITIAL_STOCK", "PURCHASE", "SALE", "ADJUSTMENT", "WASTE", "RETURN"];

export function MovementsTab() {
  const [type, setType] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const options = useQuery({ queryKey: qk.inventoryOptions, queryFn: api.getInventoryOptions });
  const filters = {
    type: type === "all" ? undefined : type,
    inventory_item_id: itemId === "all" ? undefined : Number(itemId),
    from: from || undefined,
    to: to || undefined,
    page,
    per_page: 25,
  };
  const query = useQuery({ queryKey: qk.movements(filters), queryFn: () => api.getMovements(filters), placeholderData: keepPreviousData });

  const set =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };
  const filtered = type !== "all" || itemId !== "all" || from || to;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={type} onValueChange={set(setType)}>
          <SelectTrigger className="h-9 w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={itemId} onValueChange={set(setItemId)}>
          <SelectTrigger className="h-9 w-48 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            {options.data?.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          From
          <Input type="date" className="h-9 w-40 bg-card" value={from} max={to || undefined} onChange={(e) => set(setFrom)(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          To
          <Input type="date" className="h-9 w-40 bg-card" value={to} min={from || undefined} onChange={(e) => set(setTo)(e.target.value)} />
        </label>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setType("all");
              setItemId("all");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <LoadingState rows={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={History}
          title="No stock movements found"
          description={filtered ? "Try widening the filters." : "Movements appear when stock is purchased, sold or adjusted."}
        />
      ) : (
        <>
          <MovementsTable movements={query.data.items} />
          <Pagination meta={query.data.pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
