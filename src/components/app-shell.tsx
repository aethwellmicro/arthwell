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
  Keyboard,
} from 'lucide-react'
import { useApp, canManageUsers, canManageSettings, type ViewKey } from '@/lib/store'
import { apiFetch, formatMoneyCompact } from '@/lib/format'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
        <img src="/arthwell-logo.svg" alt="ArthWell" className="h-9 w-9 rounded-lg" />
        <div>
          <p className="font-semibold text-sm leading-tight">ArthWell</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Micro Finance</p>
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
                'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors group',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                restricted && !active && 'opacity-60'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-transform', active ? '' : 'group-hover:scale-110')} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.key === 'notifications' && <NotificationBadge active={active} />}
              {restricted && <Lock className="h-3 w-3 opacity-60" />}
            </button>
          )
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Button onClick={() => startCollection()} className="w-full" size="sm">
          <HandCoins className="h-4 w-4 mr-2" /> Quick Collection
        </Button>
        <SidebarQuickStats />
      </div>
    </div>
  )
}

function NotificationBadge({ active }: { active: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const data = await apiFetch<{ items: any[] }>('/api/notifications?status=PENDING&limit=100')
        if (!cancel) setCount(data.items.length)
      } catch {}
    }
    load()
    const interval = setInterval(load, 30000) // refresh every 30s
    return () => { cancel = true; clearInterval(interval) }
  }, [])

  if (count === 0) return null

  return (
    <span className={cn(
      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
      active ? 'bg-primary-foreground text-primary' : 'bg-red-500 text-white'
    )}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function SidebarQuickStats() {
  const [stats, setStats] = useState<{ todayCollected: number; overdueCount: number } | null>(null)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const d = await apiFetch<{ stats: { todayCollected: number; overdueAccountCount: number } }>('/api/dashboard')
        if (!cancel) setStats({ todayCollected: d.stats.todayCollected, overdueCount: d.stats.overdueAccountCount })
      } catch {}
    }
    load()
    const interval = setInterval(load, 60000) // refresh every minute
    return () => { cancel = true; clearInterval(interval) }
  }, [])

  if (!stats) return null

  return (
    <div className="rounded-lg bg-sidebar-accent/60 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" /> Today
        </span>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatMoneyCompact(stats.todayCollected)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Overdue</span>
        <span className={cn('text-sm font-bold', stats.overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{stats.overdueCount}</span>
      </div>
    </div>
  )
}

export function AppShell() {
  const { user, view, setView, logout, setSearchQuery, startCollection } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const { theme, setTheme } = useTheme()
  const [searchVal, setSearchVal] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea/select
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return
      // Ctrl/Cmd + K -> New Collection
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        startCollection()
        toast.info('Quick Collection', { description: 'Press Ctrl+K anytime to start a new collection' })
      }
      // ? -> Help modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowHelp((s) => !s)
        return
      }
      // 'c' -> Customers, 'd' -> Dashboard, 'r' -> Reports, 'a' -> Accounts, 'o' -> Collections, 'e' -> Employees (single-key shortcuts)
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('customers')
      } else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('dashboard')
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('reports')
      } else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('accounts')
      } else if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('collections')
      } else if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setView('employees')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startCollection, setView])

  async function doLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    logout()
    toast.success('Signed out')
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchVal.trim()
    if (!q) return
    // Smart routing: if query looks like an account number (LN-), go to accounts
    // If it looks like a receipt number (RCP-), go to receipts
    // Otherwise, search customers
    const upperQ = q.toUpperCase()
    if (/^LN[-\s]?\d/i.test(upperQ)) {
      // Account number search — go to accounts view (the accounts view has its own search)
      toast.info('Searching accounts for "' + q + '"')
      setView('accounts')
    } else if (/^RCP[-\s]?\d/i.test(upperQ)) {
      // Receipt number search — go to receipts view
      toast.info('Searching receipts for "' + q + '"')
      setView('receipts')
    } else {
      // Default: customer search
      setSearchQuery(q)
      setView('customers')
    }
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight truncate">{TITLES[view]}</h1>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <form onSubmit={onSearchSubmit} className="hidden md:flex items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search customers, accounts (LN-), receipts (RCP-)…"
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

      {/* Floating Action Button (mobile only) */}
      <Button
        onClick={() => startCollection()}
        className="lg:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        size="icon"
        aria-label="Quick Collection"
      >
        <HandCoins className="h-6 w-6" />
      </Button>

      {/* Footer */}
      <footer className="mt-auto border-t bg-sidebar/40">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 lg:px-6 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <img src="/arthwell-logo.svg" alt="ArthWell" className="h-4 w-4" />
              <span>ArthWell Micro Finance · Collection & Loan Management</span>
            </div>
            <span className="hidden sm:inline text-muted-foreground/40">·</span>
            <span className="hidden sm:inline">Shortcuts:</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
              Ctrl+K <span className="text-muted-foreground">Collection</span>
            </kbd>
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
              D <span className="text-muted-foreground">Dashboard</span>
            </kbd>
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
              C <span className="text-muted-foreground">Customers</span>
            </kbd>
          </div>
          <div className="flex items-center gap-3">
            <span>Internal Use Only</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowHelp(true)} aria-label="Keyboard shortcuts">
              <Keyboard className="h-3 w-3 mr-1" /> Shortcuts
            </Button>
            {canManageSettings(user?.role) && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={reseed} aria-label="Re-seed">
                <Database className="h-3 w-3 mr-1" /> Re-seed
              </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Keyboard shortcuts help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Keyboard className="h-5 w-5 text-primary" /> Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { keys: ['Ctrl', 'K'], desc: 'New Collection (quick)' },
              { keys: ['D'], desc: 'Go to Dashboard' },
              { keys: ['C'], desc: 'Go to Customers' },
              { keys: ['A'], desc: 'Go to Accounts / Loans' },
              { keys: ['O'], desc: 'Go to Collections' },
              { keys: ['R'], desc: 'Go to Reports' },
              { keys: ['E'], desc: 'Go to Employees' },
              { keys: ['?'], desc: 'Toggle this help dialog' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-dashed last:border-0">
                <span className="text-sm text-muted-foreground">{s.desc}</span>
                <div className="flex gap-1">
                  {s.keys.map((k, j) => (
                    <kbd key={j} className="inline-flex items-center justify-center min-w-[28px] rounded border bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">Shortcuts are disabled while typing in input fields.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
