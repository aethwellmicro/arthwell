"use client";

import * as React from "react";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Landmark,
  HandCoins,
  ReceiptText,
  BarChart3,
  UserCog,
  ScrollText,
  Bell,
  Settings,
  Menu,
  Search,
  LogOut,
  Wallet,
  Lock,
  Database,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  ROLE_LABELS,
  ROLE_BADGE_CLASS,
  canManageEmployees,
  canManageSettings,
  type ViewKey,
} from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  restricted?: boolean;
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "customers", label: "Customers", icon: Users },
  { key: "accounts", label: "Accounts / Loans", icon: Landmark },
  { key: "collections", label: "Collections", icon: HandCoins },
  { key: "receipts", label: "Receipts", icon: ReceiptText },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "employees", label: "Employees", icon: UserCog, restricted: true },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings, restricted: true },
];

const TITLES: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  accounts: "Accounts / Loans",
  collections: "Collections",
  receipts: "Receipts",
  reports: "Reports",
  employees: "Employees",
  audit: "Audit Logs",
  notifications: "Notifications",
  settings: "Settings",
};

function BrandHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight">
          Collection &amp; Loan Mgmt
        </div>
        <div className="text-xs text-muted-foreground">Main Branch · MG Road</div>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user)!;
  const canSeeRestricted = canManageEmployees(user.role);

  return (
    <nav className="flex flex-col gap-1 px-2 pb-4" aria-label="Main navigation">
      {NAV.map((item) => {
        const locked = item.restricted && !canSeeRestricted;
        const Icon = item.icon;
        const active = view === item.key;
        const inner = (
          <button
            type="button"
            onClick={() => {
              if (locked) return;
              setView(item.key);
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            aria-disabled={locked}
            className={cn(
              "flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
              locked && "cursor-not-allowed opacity-50"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        );
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <div>{inner}</div>
            </TooltipTrigger>
            {locked && (
              <TooltipContent side="right">
                Restricted to Admin / Branch Manager
              </TooltipContent>
            )}
          </Tooltip>
        );
      })}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function UserMenu() {
  const user = useAppStore((s) => s.user)!;
  const logout = useAppStore((s) => s.logout);
  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    logout();
    toast.success("Signed out");
  }
  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden text-left md:block">
            <div className="text-xs font-medium leading-tight">{user.name}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              {user.email}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span>{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <span
            className={cn(
              "mt-1 inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[10px] font-medium",
              ROLE_BADGE_CLASS[user.role] || "bg-muted"
            )}
          >
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const setGlobalSearch = useAppStore((s) => s.setGlobalSearch);
  const setView = useAppStore((s) => s.setView);
  const openCustomer = useAppStore((s) => s.openCustomer);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalSearch(q);
    openCustomer(null);
    setView("customers");
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-md">
      <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search customers by name, mobile, ID…"
        className="pl-9"
        aria-label="Global search"
      />
    </form>
  );
}

function ReSeedButton() {
  const [loading, setLoading] = useState(false);
  async function reseed() {
    if (
      !confirm("This will wipe current data and re-seed demo data. Continue?")
    )
      return;
    setLoading(true);
    try {
      await apiFetch("/api/seed", { method: "POST" });
      toast.success("Demo data re-seeded");
      setTimeout(() => window.location.reload(), 600);
    } catch (err: any) {
      toast.error(err?.message || "Re-seed failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={reseed}
      disabled={loading}
      className="gap-2"
    >
      <Database className="h-3.5 w-3.5" />
      {loading ? "Seeding…" : "Re-seed Demo Data"}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user)!;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
          <BrandHeader />
          <NavList />
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <BrandHeader />
            <NavList onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-semibold md:text-lg">{TITLES[view]}</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block">
                <GlobalSearch />
              </div>
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </main>

          <footer className="mt-auto border-t bg-card px-4 py-3 md:px-6">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">
                  Collection &amp; Loan Management
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  Internal Use Only — Authorized Employees
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline">
                  Logged in as{" "}
                  <span className="font-medium text-foreground">{user.name}</span>{" "}
                  ({ROLE_LABELS[user.role] || user.role})
                </span>
                {canManageSettings(user.role) && <ReSeedButton />}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
