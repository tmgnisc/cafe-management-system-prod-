"use client";

import { RequireAuth } from "@/lib/auth";

/** Every /admin/* route is SUPERADMIN-only (UX guard — the API enforces it too). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["SUPERADMIN"]}>{children}</RequireAuth>;
}
