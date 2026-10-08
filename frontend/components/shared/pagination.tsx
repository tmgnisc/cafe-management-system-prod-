import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pagination as PaginationMeta } from "@/types";

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta | undefined; onPageChange: (page: number) => void }) {
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.per_page + 1;
  const to = Math.min(meta.page * meta.per_page, meta.total);
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span>
        Showing <span className="font-medium text-foreground">{from}</span>–<span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{meta.total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
          <ChevronLeft /> Prev
        </Button>
        <span className="tabular-nums">
          {meta.page} / {meta.total_pages}
        </span>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.total_pages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page">
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
