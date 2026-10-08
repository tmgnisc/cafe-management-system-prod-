"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Package,
  ScrollText,
  Settings,
  UserRound,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { cn, humanize, initials } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Highlight for nested routes too */
  match?: string[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Service",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPERADMIN"] },
      { href: "/pos", label: "POS · Tables", icon: LayoutGrid, roles: ["SUPERADMIN", "STAFF"], match: ["/pos"] },
      { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["STAFF"], match: ["/orders"] },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList, roles: ["SUPERADMIN"], match: ["/admin/orders", "/orders"] },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/tables", label: "Tables", icon: UtensilsCrossed, roles: ["SUPERADMIN"] },
      { href: "/admin/menu", label: "Menu & Recipes", icon: ChefHat, roles: ["SUPERADMIN"] },
      { href: "/admin/inventory", label: "Inventory", icon: Package, roles: ["SUPERADMIN"] },
      { href: "/admin/staff", label: "Staff", icon: Users, roles: ["SUPERADMIN"] },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["SUPERADMIN"] },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["SUPERADMIN"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["SUPERADMIN"] },
    ],
  },
  {
    section: "Account",
    items: [{ href: "/profile", label: "My Profile", icon: UserRound, roles: ["SUPERADMIN", "STAFF"] }],
  },
];

function isActive(pathname: string, item: NavItem) {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-inner">
        <Coffee className="size-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[1.05rem] font-semibold">Isha&apos;s Cozy Cafe</div>
          <div className="text-[11px] tracking-wider text-sidebar-foreground/60 uppercase">Point of Sale</div>
        </div>
      )}
    </Link>
  );
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={group.section}>
            <div className="px-3 pb-1.5 text-[11px] font-medium tracking-wider text-sidebar-foreground/45 uppercase">{group.section}</div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className={cn("size-[18px]", active ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu({ dark }: { dark?: boolean }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
            dark ? "hover:bg-sidebar-accent" : "hover:bg-muted",
          )}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-caramel/80 text-sm font-semibold text-sidebar-primary-foreground">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className={cn("truncate text-sm font-medium", dark ? "text-sidebar-foreground" : "text-foreground")}>{user.name}</div>
            <div className={cn("truncate text-xs", dark ? "text-sidebar-foreground/55" : "text-muted-foreground")}>{humanize(user.role)}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pt-6 pb-6">
          <Brand />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3">
          <NavList role={user.role} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <UserMenu dark />
        </div>
      </aside>

      {/* Mobile / tablet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="px-5 pt-6 pb-6">
              <Brand />
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <NavList role={user.role} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-sidebar-border p-3">
              <UserMenu dark />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation">
            <MenuIcon className="size-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <Coffee className="size-5 text-primary" />
            <span className="font-display font-semibold">Isha&apos;s Cozy Cafe</span>
          </Link>
        </header>
        <main className="bg-cafe-texture flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

/** Standard padded page container for non-POS screens. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</div>;
}
