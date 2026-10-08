"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FullScreenLoader, RequireAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </Suspense>
  );
}
