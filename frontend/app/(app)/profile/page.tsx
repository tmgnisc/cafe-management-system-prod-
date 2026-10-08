"use client";

import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageContainer } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge, UserStatusBadge } from "@/components/shared/status-badges";
import { ChangePasswordForm, ProfileDetailsForm } from "@/components/profile/profile-forms";
import { useAuth } from "@/lib/auth";
import { formatDateTime, initials } from "@/lib/utils";

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="My Profile" icon={UserRound} description="Manage your personal details and password." />

      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-secondary/70 to-card p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary font-display text-xl font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-display text-2xl font-semibold">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoleBadge role={user.role} />
            <UserStatusBadge status={user.status} />
          </div>
        </div>
        <div className="text-sm text-muted-foreground sm:text-right">
          <div>Member since {formatDateTime(user.created_at, "MMM yyyy")}</div>
          <div>Last login {formatDateTime(user.last_login)}</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileDetailsForm />
        <ChangePasswordForm />
      </div>
    </PageContainer>
  );
}
