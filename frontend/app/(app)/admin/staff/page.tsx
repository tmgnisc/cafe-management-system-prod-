"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MoreHorizontal, Pencil, Power, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { RoleBadge, UserStatusBadge } from "@/components/shared/status-badges";
import { ResetPasswordDialog } from "@/components/staff/reset-password-dialog";
import { StaffFormDialog } from "@/components/staff/staff-form-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/query-keys";
import { formatDateTime, initials, timeAgo } from "@/lib/utils";
import type { User } from "@/types";

export default function StaffPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const filters = { page, per_page: 15, search: debounced, role: role === "all" ? "" : role, status: status === "all" ? "" : status };
  const query = useQuery({ queryKey: qk.staff(filters), queryFn: () => api.getStaff(filters), placeholderData: keepPreviousData });

  const toggle = useMutation({
    mutationFn: (u: User) => api.updateStaff(u.id, { status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: (u) => {
      toast.success(`${u.name} is now ${u.status === "ACTIVE" ? "active" : "inactive"}`);
      qc.invalidateQueries({ queryKey: qk.staffAll });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (u: User) => api.deleteStaff(u.id),
    onSuccess: (_data, u) => {
      toast.success(_data && "id" in _data ? `${u.name} has order history and was deactivated instead of deleted` : `${u.name} deleted`);
      qc.invalidateQueries({ queryKey: qk.staffAll });
      setDeleting(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setFormOpen(true);
  };

  const items = query.data?.items ?? [];

  const actions = (u: User) => {
    const self = u.id === me?.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => openEdit(u)}>
            <Pencil /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetting(u)}>
            <KeyRound /> Reset password
          </DropdownMenuItem>
          <DropdownMenuItem disabled={self || toggle.isPending} onClick={() => toggle.mutate(u)}>
            <Power /> {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={self} onClick={() => setDeleting(u)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Staff"
        icon={Users}
        description="Manage team accounts, roles and access."
        actions={
          <Button onClick={openCreate}>
            <UserPlus /> Add staff
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search name, email or phone…"
        />
        <div className="flex gap-2">
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState rows={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff found"
          description={debounced || role !== "all" || status !== "all" ? "Try a different search or filter." : "Add your first team member to get started."}
          action={
            <Button variant="outline" onClick={openCreate}>
              <UserPlus /> Add staff
            </Button>
          }
        />
      ) : (
        <div>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-secondary text-xs font-semibold text-primary">{initials(u.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {u.name}
                            {u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" title={formatDateTime(u.last_login)}>
                      {u.last_login ? timeAgo(u.last_login) : "Never"}
                    </TableCell>
                    <TableCell>{actions(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {items.map((u) => (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-secondary text-sm font-semibold text-primary">{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <RoleBadge role={u.role} />
                      <UserStatusBadge status={u.status} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {u.phone || "No phone"} · Last login {u.last_login ? timeAgo(u.last_login) : "never"}
                    </div>
                  </div>
                  {actions(u)}
                </div>
              </div>
            ))}
          </div>

          <Pagination meta={query.data?.pagination} onPageChange={setPage} />
        </div>
      )}

      <StaffFormDialog open={formOpen} onOpenChange={setFormOpen} staff={editing} isSelf={editing?.id === me?.id} />
      <ResetPasswordDialog staff={resetting} onOpenChange={(o) => !o && setResetting(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "staff member"}?`}
        description="Accounts with order or payment history are deactivated instead of deleted, so historical records stay intact."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </PageContainer>
  );
}
