"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, FilterX, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditDetailDialog } from "@/components/audit/audit-detail-dialog";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Pill, type Tone } from "@/components/shared/status-badges";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { formatDateTime, humanize, timeAgo } from "@/lib/utils";
import type { AuditLog } from "@/types";

function actionTone(action: string): Tone {
  if (/CANCEL|DELETE|DEACTIVAT|WASTE|ARCHIV/.test(action)) return "red";
  if (/PAYMENT|CREATED|LOGIN$/.test(action)) return "green";
  if (/DISCOUNT|PRICE|PASSWORD/.test(action)) return "amber";
  if (/INVENTORY|RECIPE/.test(action)) return "caramel";
  if (/LOGOUT/.test(action)) return "gray";
  return "blue";
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const debounced = useDebounce(search);

  const filters = { page, per_page: 25, search: debounced, action: action === "all" ? "" : action, from, to };
  const query = useQuery({ queryKey: qk.auditLogs(filters), queryFn: () => api.getAuditLogs(filters), placeholderData: keepPreviousData });

  const items = query.data?.items ?? [];
  const actions = query.data?.actions ?? [];
  const hasFilters = !!(search || action !== "all" || from || to);

  const reset = () => {
    setSearch("");
    setAction("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader title="Audit Logs" icon={ScrollText} description="A trail of every sensitive action in the system — who did what, and when." />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search description or user…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-52 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {humanize(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-38 bg-card"
              aria-label="From date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-38 bg-card"
              aria-label="To date"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <FilterX /> Clear
            </Button>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState rows={10} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries found" description={hasFilters ? "Try widening your filters." : "Actions will appear here as the team works."} />
      ) : (
        <div>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                    <TableCell className="pl-4 whitespace-nowrap">
                      <div className="text-sm">{formatDateTime(log.created_at, "dd MMM, h:mm a")}</div>
                      <div className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-medium">{log.user_name ?? "System"}</div>
                      <div className="text-xs text-muted-foreground">{log.user_role ? humanize(log.user_role) : ""}</div>
                    </TableCell>
                    <TableCell>
                      <Pill tone={actionTone(log.action)}>{humanize(log.action)}</Pill>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm" title={log.description}>
                        {log.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-2 md:hidden">
            {items.map((log) => (
              <button key={log.id} onClick={() => setSelected(log)} className="rounded-2xl border border-border bg-card p-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={actionTone(log.action)}>{humanize(log.action)}</Pill>
                  <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">{log.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{log.user_name ?? "System"}</p>
              </button>
            ))}
          </div>

          <Pagination meta={query.data?.pagination} onPageChange={setPage} />
        </div>
      )}

      <AuditDetailDialog log={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </PageContainer>
  );
}
