"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Pill } from "@/components/shared/status-badges";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatQty } from "@/lib/utils";
import { RecipeEditor } from "./recipe-editor";

export function RecipesTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<number | null>(null);
  const query = useQuery({ queryKey: qk.recipes, queryFn: api.getRecipes });

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (query.data ?? []).filter((r) => {
      if (s && !r.menu_item_name.toLowerCase().includes(s) && !r.items.some((i) => i.inventory_item_name.toLowerCase().includes(s))) return false;
      if (filter === "with" && !r.items.length) return false;
      if (filter === "without" && r.items.length) return false;
      return true;
    });
  }, [query.data, search, filter]);

  const missing = (query.data ?? []).filter((r) => !r.items.length).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search item or ingredient…" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-44 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All menu items</SelectItem>
              <SelectItem value="with">With recipe</SelectItem>
              <SelectItem value="without">Without recipe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {missing > 0 && (
          <Pill tone="amber">
            {missing} item{missing === 1 ? "" : "s"} without a recipe
          </Pill>
        )}
      </div>

      {query.isLoading ? (
        <LoadingState variant="cards" rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !list.length ? (
        <EmptyState icon={BookOpen} title="No recipes found" description="Add menu items first, then define which ingredients each serving uses." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <div key={r.menu_item_id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">{r.menu_item_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.menu_item_sku} · {r.category_name}
                  </p>
                </div>
                {r.track_inventory ? <Pill tone="green">Tracked</Pill> : <Pill tone="gray">Not tracked</Pill>}
              </div>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {r.items.length ? (
                  r.items.map((i) => (
                    <li key={i.inventory_item_id} className="flex justify-between gap-2 border-b border-dashed border-border pb-1.5 last:border-0">
                      <span>{i.inventory_item_name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatQty(i.quantity)} {i.unit}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground italic">No ingredients yet</li>
                )}
              </ul>
              <Button variant="outline" size="sm" className="mt-3 self-start" onClick={() => setEditing(r.menu_item_id)}>
                <Pencil /> {r.items.length ? "Edit recipe" : "Add recipe"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <RecipeEditor menuItemId={editing} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} />
    </div>
  );
}
