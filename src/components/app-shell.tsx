'use client'

import { useEffect, useState } from 'react'
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
  Settings as SettingsIcon,
  Wallet,
  LogOut,
  Search,
  Menu,
  Moon,
  Sun,
  Lock,
  Database,
} from 'lucide-react'
import { useApp, canManageUsers, canManageSettings, type ViewKey } from '@/lib/store'
import { apiFetch } from '@/lib/format'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { DashboardView } from '@/components/views/dashboard'
import { CustomersView } from '@/components/views/customers'
import { AccountsView } from '@/components/views/accounts'
import { CollectionsView } from '@/components/views/collections'
import { ReceiptsView } from '@/components/views/receipts'
import { ReportsView } from '@/components/views/reports'
import { EmployeesView } from '@/components/views/employees'
import { AuditLogsView } from '@/components/views/audit-logs'
import { NotificationsView } from '@/components/views/notifications'
import { SettingsView } from '@/components/views/settings'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  restricted?: boolean
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'accounts', label: 'Accounts / Loans', icon: Landmark },
  { key: 'collections', label: 'Collections', icon: HandCoins },
  { key: 'receipts', label: 'Receipts', icon: ReceiptText },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'employees', label: 'Employees', icon: UserCog, restricted: true },
  { key: 'audit', label: 'Audit Logs', icon: ScrollText },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, restricted: true },
]

const TITLES: Record<ViewKey, string> = {
  dashboard: 'Dashboard',
  customers: 'Customer Management',
  accounts: 'Accounts / Loans',
  collections: 'Daily Collection',
  receipts: 'Receipt Management',
  reports: 'Reports & Analytics',
  employees: 'Employee Management',
  audit: 'Audit Logs',
  notifications: 'Notifications',
  settings: 'System Settings',
}

function renderSidebar({
  user,
  view,
  navClick,
  startCollection,
}: {
  user: any
  view: ViewKey
  navClick: (item: NavItem) => void
  startCollection: (customerId?: string, accountId?: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">LoanLedger</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Main Branch · MGR</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto scroll-area p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const restricted = item.restricted && !canManageUsers(user?.role)
          const active = view === item.key
          return (
            <button
              key={item.key}
              onClick={() => navClick(item)}
              className={cn(
                'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                restricted && !active && 'opacity-60'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {restricted && <Lock className="h-3 w-3 opacity-60" />}
            </button>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Button onClick={() => startCollection()} className="w-full" size="sm">
          <HandCoins className="h-4 w-4 mr-2" /> New Collection
        </Button>
      </div>
    </div>
  )
}

export function AppShell() {
  const { user, view, setView, logout, setSearchQuery, startCollection } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [searchVal, setSearchVal] = useState('')

  useEffect(() => {
    // keyboard nav is fine; nothing extra needed
  }, [])

  async function doLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    logout()
    toast.success('Signed out')
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchVal)
    setView('customers')
  }

  function navClick(item: NavItem) {
    if (item.restricted && !canManageUsers(user?.role)) {
      toast.error('You do not have access to this section.')
      return
    }
    setView(item.key)
    setMobileOpen(false)
  }

  async function reseed() {
    if (!confirm('This will erase all current data and reload demo data. Continue?')) return
    try {
      await apiFetch('/api/seed', { method: 'POST' })
      toast.success('Demo data reloaded')
      setTimeout(() => location.reload(), 800)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const initials = (user?.name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  const sidebar = renderSidebar({ user, view, navClick, startCollection })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          {sidebar}
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-3 px-4 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{TITLES[view]}</h1>
            </div>
            <form onSubmit={onSearchSubmit} className="hidden md:flex items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search customers, mobile, ID…"
                  className="pl-8 w-64 lg:w-72"
                />
              </div>
            </form>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-accent p-1 pr-2 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium leading-tight">{user?.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[user?.role || '']}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                    <Badge className={cn('w-fit', ROLE_COLORS[user?.role || ''])}>
                      {ROLE_LABELS[user?.role || '']}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canManageSettings(user?.role) && (
                  <DropdownMenuItem onClick={reseed}>
                    <Database className="h-4 w-4 mr-2" /> Re-seed Demo Data
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={doLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* View content */}
          <main className="flex-1 p-4 lg:p-6">
            <div key={view} className="view-fade-in">
              {view === 'dashboard' && <DashboardView />}
              {view === 'customers' && <CustomersView />}
              {view === 'accounts' && <AccountsView />}
              {view === 'collections' && <CollectionsView />}
              {view === 'receipts' && <ReceiptsView />}
              {view === 'reports' && <ReportsView />}
              {view === 'employees' && <EmployeesView />}
              {view === 'audit' && <AuditLogsView />}
              {view === 'notifications' && <NotificationsView />}
              {view === 'settings' && <SettingsView />}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t bg-sidebar/40">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 lg:px-6 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span>LoanLedger · Internal Collection & Loan Management System</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Internal Use Only — Authorized Employees</span>
            {canManageSettings(user?.role) && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={reseed} aria-label="Re-seed">
                <Database className="h-3 w-3 mr-1" /> Re-seed
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
