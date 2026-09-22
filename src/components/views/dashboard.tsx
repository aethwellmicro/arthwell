'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Landmark,
  Banknote,
  Wallet,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  HandCoins,
  ArrowRight,
  RefreshCw,
  BellRing,
  ScrollText,
  Phone,
  MessageCircle,
  X,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { apiFetch, formatMoney, formatMoneyCompact, formatDateTime, formatRelativeTime, STATUS_COLORS } from '@/lib/format'
import { useApp } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { StatCard, SectionCard, EmptyState, LoadingRows, SkeletonCard } from '@/components/ui-bits'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Dashboard {
  stats: {
    totalCustomers: number
    activeCustomers: number
    totalAccounts: number
    totalDisbursed: number
    totalPayable: number
    totalCollected: number
    totalOutstanding: number
    totalOverdue: number
    todayCollected: number
    todayDue: number
    todayPending: number
    weekCollected: number
    monthCollected: number
    sixMonthCollected: number
    overdueAccountCount: number
    totalGroups?: number
    pendingCustomers?: number
    approvedCustomers?: number
    rejectedCustomers?: number
    disbursedCustomers?: number
  }
  pendingApprovals?: {
    id: string
    customerId: string
    fullName: string
    primaryMobile: string
    amount: number
    branch: string
    status: string
    createdAt: string
    group?: { id: string; groupId: string; name: string } | null
    createdBy?: { id: string; name: string } | null
  }[]
  byMode: Record<string, number>
  byEmployee: { name: string; role: string; amount: number }[]
  overdueAccounts: { accountNumber: string; customer: string; customerId: string; mobile: string; overdueAmount: number; maxOverdueDays: number }[]
  todayCollections: any[]
  trend: { month: string; amount: number }[]
  statusBreakdown: Record<string, number>
  agingBuckets: { '0-30': number; '31-60': number; '61-90': number; '90+': number }
  projectedDaily: { date: string; amount: number }[]
}

const MODE_COLORS: Record<string, string> = {
  CASH: '#10b981',
  UPI: '#0d9488',
  BANK: '#0891b2',
  OTHER: '#7c3aed',
}
const STATUS_PIE_COLORS = ['#10b981', '#0891b2', '#f59e0b', '#64748b', '#ef4444']

export function DashboardView() {
  const router = useRouter()
  const { user } = useApp()
  const setView = (view: string) => router.push(`/${view}`)
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [trendMonths, setTrendMonths] = useState(6)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [agingFilter, setAgingFilter] = useState<string | null>(null)

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const d = await apiFetch<Dashboard>('/api/dashboard')
      setData(d)
      // Fetch recent activity (latest 6 audit logs)
      try {
        const logs = await apiFetch<{ items: any[] }>('/api/audit-logs?limit=6')
        setRecentActivity(logs.items)
      } catch {}
    } catch (e: any) {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function sendReminder(account: { customer: string; customerId: string; mobile: string; overdueAmount: number; accountNumber: string }) {
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'OVERDUE_REMINDER',
          recipient: account.mobile,
          message: `Dear ${account.customer}, your account ${account.accountNumber} has an overdue amount of ${account.overdueAmount.toFixed(2)}. Please make the payment at the earliest to avoid penalties. Thank you.`,
          customerId: account.customerId,
        }),
      })
      toast.success(`Reminder sent to ${account.customer}`, { description: `SMS queued for ${account.mobile}` })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2"><CardContent className="p-4 h-72"><LoadingRows rows={4} /></CardContent></Card>
          <Card><CardContent className="p-4 h-72"><LoadingRows rows={4} /></CardContent></Card>
        </div>
      </div>
    )
  }
  if (!data) return <EmptyState message="Could not load dashboard data." />

  const { stats } = data
  const modeData = Object.entries(data.byMode).map(([k, v]) => ({ name: k, value: v }))
  const statusData = Object.entries(data.statusBreakdown).map(([k, v]) => ({ name: k, value: v }))
  const trendData = trendMonths === 6 ? data.trend : data.trend.slice(-Math.min(trendMonths, data.trend.length))

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setView('customers')}>
          <Users className="h-4 w-4 mr-2" /> New Customer
        </Button>
        <Button variant="secondary" onClick={() => router.push('/collections')}>
          <HandCoins className="h-4 w-4 mr-2" /> New Collection
        </Button>
        <Button variant="outline" onClick={() => setView('reports')}>
          View Reports <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => loadDashboard(true)} disabled={refreshing} aria-label="Refresh dashboard" className="ml-auto">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* My performance banner (for collection employees / managers) */}
      {user && (user.role === 'COLLECTION_EMPLOYEE' || user.role === 'BRANCH_MANAGER' || user.role === 'ACCOUNTANT') && (() => {
        const myStats = data.byEmployee.find((e) => e.name === user.name)
        const myTodayCount = data.todayCollections.filter((c) => c.collectedBy === user.name).length
        const myTodayAmount = data.todayCollections.filter((c) => c.collectedBy === user.name).reduce((s, c) => s + c.amount, 0)
        return (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    {user.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">Your collection performance</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Today</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(myTodayAmount)}</p>
                    <p className="text-[10px] text-muted-foreground">{myTodayCount} txns</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">All-Time</p>
                    <p className="text-lg font-bold">{formatMoney(myStats?.amount || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">total collected</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rank</p>
                    <p className="text-lg font-bold">#{data.byEmployee.findIndex((e) => e.name === user.name) + 1 || '—'}</p>
                    <p className="text-[10px] text-muted-foreground">of {data.byEmployee.length} collectors</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Branch Manager / Admin: Pending Customer Approvals Queue */}
      {data.pendingApprovals && data.pendingApprovals.length > 0 && (
        <SectionCard
          title="Pending Customer Approvals"
          description={`${data.pendingApprovals.length} customers waiting for Branch Manager verification before disbursement`}
          action={
            <Button variant="ghost" size="sm" onClick={() => router.push('/customers?status=PENDING_VERIFICATION')}>
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[750px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Group</th>
                  <th className="px-4 py-2 font-medium">Branch</th>
                  <th className="px-4 py-2 font-medium">Field Officer</th>
                  <th className="px-4 py-2 font-medium">Created Date</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingApprovals.map((pa) => (
                  <tr key={pa.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{pa.fullName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{pa.customerId} · {pa.primaryMobile}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {pa.group ? (
                        <span className="inline-flex items-center text-xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {pa.group.groupId} - {pa.group.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No Group</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{pa.branch || 'Main Branch'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{pa.createdBy?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(pa.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => router.push(`/customers/${pa.id}`)}
                        >
                          Review
                        </Button>
                        {(user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER') && (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/customers/${pa.id}/approve`, { method: 'POST' })
                                toast.success(`${pa.fullName} approved!`)
                                loadDashboard(true)
                              } catch (e: any) {
                                toast.error(e.message)
                              }
                            }}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={String(stats.totalCustomers)} animateValue={stats.totalCustomers} animateFormat={(n) => String(n)} sub={`${stats.activeCustomers} active / ready`} icon={Users} tone="default" onClick={() => setView('customers')} />
        <StatCard label="Pending Approval" value={String(stats.pendingCustomers ?? 0)} animateValue={stats.pendingCustomers ?? 0} animateFormat={(n) => String(n)} sub="Awaiting Manager" icon={AlertTriangle} tone="warning" onClick={() => router.push('/customers?status=PENDING_VERIFICATION')} />
        <StatCard label="Active Accounts" value={String(stats.totalAccounts)} animateValue={stats.totalAccounts} animateFormat={(n) => String(n)} sub="Loans disbursed" icon={Landmark} tone="info" onClick={() => setView('accounts')} />
        <StatCard label="Total Disbursed" value={formatMoneyCompact(stats.totalDisbursed)} animateValue={stats.totalDisbursed} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalDisbursed)} sub="Principal amount" icon={Banknote} tone="default" onClick={() => setView('accounts')} />
        <StatCard label="Total Collected" value={formatMoneyCompact(stats.totalCollected)} animateValue={stats.totalCollected} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalCollected)} sub={`6-mo: ${formatMoneyCompact(stats.sixMonthCollected)}`} icon={Wallet} tone="success" onClick={() => setView('collections')} />
        <StatCard label="Total Outstanding" value={formatMoneyCompact(stats.totalOutstanding)} animateValue={stats.totalOutstanding} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalOutstanding)} sub="Across all accounts" icon={TrendingUp} tone="warning" onClick={() => setView('reports')} />
        <StatCard label="Total Overdue" value={formatMoneyCompact(stats.totalOverdue)} animateValue={stats.totalOverdue} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalOverdue)} sub={`${stats.overdueAccountCount} accounts`} icon={AlertTriangle} tone="danger" onClick={() => setView('reports')} />
        <StatCard label="Today's Collection" value={formatMoneyCompact(stats.todayCollected)} animateValue={stats.todayCollected} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.todayCollected)} sub={`Due: ${formatMoneyCompact(stats.todayDue)}`} icon={HandCoins} tone="success" onClick={() => setView('collections')} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Collection Trend"
          description={`Last ${trendMonths} months`}
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
              {[3, 6].map((m) => (
                <button
                  key={m}
                  onClick={() => setTrendMonths(m)}
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    trendMonths === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m}M
                </button>
              ))}
            </div>
          }
        >
          <div className="h-72 p-4">
            {trendData.some((t) => t.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#cAmt)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={`No collection data for the last ${trendMonths} months.`} icon={TrendingUp} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="By Payment Mode" description="All-time collected">
          <div className="h-72 p-4">
            {modeData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {modeData.map((entry, i) => (
                      <Cell key={i} fill={MODE_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No collections yet." />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Employee + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Collection by Employee" description="All-time totals" className="lg:col-span-2">
          <div className="h-64 p-4">
            {data.byEmployee.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byEmployee} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={90} />
                  <Tooltip formatter={(v: any) => formatMoney(Number(v))} contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="#10b981" radius={[0, 6, 6, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No employee collections yet." />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Account Status" description="Distribution">
          <div className="h-64 p-4 flex flex-col items-center">
            {statusData.length ? (
              <>
                <ResponsiveContainer width="100%" height="70%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {statusData.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                      <span className="font-semibold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState message="No accounts yet." />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Projected Collections widget */}
      {data.projectedDaily && data.projectedDaily.length > 0 && (() => {
        const total = data.projectedDaily.reduce((s, d) => s + d.amount, 0)
        if (total <= 0) return null
        const maxAmount = Math.max(...data.projectedDaily.map((d) => d.amount), 1)
        return (
          <SectionCard title="Projected Collections" description="Expected dues for next 7 days" action={
            <span className="text-sm font-bold text-primary">{formatMoneyCompact(total)}</span>
          }>
            <div className="p-4">
              <div className="flex items-end justify-between gap-1.5 h-32">
                {data.projectedDaily.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-primary/60 to-primary transition-all hover:from-primary hover:to-primary group-hover:opacity-80"
                        style={{ height: `${(d.amount / maxAmount) * 100}%`, minHeight: d.amount > 0 ? '4px' : '0' }}
                        title={`${d.date}: ${formatMoney(d.amount)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.date}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{d.amount > 0 ? formatMoneyCompact(d.amount) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )
      })()}

      {/* Aging bucket widget */}
      {data.agingBuckets && (() => {
        const total = data.agingBuckets['0-30'] + data.agingBuckets['31-60'] + data.agingBuckets['61-90'] + data.agingBuckets['90+']
        if (total <= 0) return null
        const bucketKeys = ['0-30', '31-60', '61-90', '90+']
        const buckets = [
          { key: '0-30', label: '0-30 days', value: data.agingBuckets['0-30'], color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
          { key: '31-60', label: '31-60 days', value: data.agingBuckets['31-60'], color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
          { key: '61-90', label: '61-90 days', value: data.agingBuckets['61-90'], color: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
          { key: '90+', label: '90+ days', value: data.agingBuckets['90+'], color: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
        ]
        return (
          <SectionCard title="Overdue Aging Analysis" description="Outstanding by age bracket — click to filter" action={agingFilter && (
            <Button variant="ghost" size="sm" onClick={() => setAgingFilter(null)}>
              <X className="h-3 w-3 mr-1" /> Clear filter
            </Button>
          )}>
            <div className="p-4 space-y-3">
              {/* Stacked bar */}
              <div className="flex h-8 rounded-lg overflow-hidden border">
                {buckets.map((b, i) => b.value > 0 && (
                  <button
                    key={i}
                    onClick={() => setAgingFilter(agingFilter === b.key ? null : b.key)}
                    className={cn(b.color, 'transition-all hover:opacity-80', agingFilter && agingFilter !== b.key && 'opacity-40')}
                    style={{ width: `${(b.value / total) * 100}%` }}
                    title={`${b.label}: ${formatMoney(b.value)} — click to filter`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {buckets.map((b, i) => (
                  <button
                    key={i}
                    onClick={() => setAgingFilter(agingFilter === b.key ? null : b.key)}
                    className={cn('flex items-center gap-2 text-left transition-opacity hover:opacity-80', agingFilter && agingFilter !== b.key && 'opacity-40')}
                  >
                    <span className={cn('h-3 w-3 rounded shrink-0', b.color)} />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-muted-foreground truncate">{b.label}</p>
                      <p className={cn('text-sm font-bold', b.text)}>{formatMoneyCompact(b.value)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        )
      })()}

      {/* Today collections + overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Today's Collections" description="Latest 10 transactions">
          <div className="max-h-96 overflow-y-auto overflow-x-auto scroll-area">
            {data.todayCollections.length ? (
              <table className="w-full text-sm zebra-table min-w-[500px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Customer</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Receipt</th>
                    <th className="px-4 py-2 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Mode</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayCollections.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 max-w-[160px]">
                        <p className="font-medium truncate" title={c.customerName}>{c.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.customerId}</p>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{c.receiptNumber}</td>
                      <td className="px-4 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatMoney(c.amount)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <Badge variant="outline">{c.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap">{c.collectedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No collections today yet." icon={HandCoins} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Overdue Accounts" description={agingFilter ? `Filtered: ${agingFilter === '0-30' ? '0-30 days' : agingFilter === '31-60' ? '31-60 days' : agingFilter === '61-90' ? '61-90 days' : '90+ days'}` : 'Top follow-up targets'} action={<Button variant="ghost" size="sm" onClick={() => setView('reports')}>View all<ArrowRight className="h-3 w-3 ml-1" /></Button>}>
          <div className="max-h-96 overflow-y-auto overflow-x-auto scroll-area">
            {(() => {
              const filtered = agingFilter
                ? data.overdueAccounts.filter((a) => {
                    const days = a.maxOverdueDays || 0
                    if (agingFilter === '0-30') return days <= 30
                    if (agingFilter === '31-60') return days > 30 && days <= 60
                    if (agingFilter === '61-90') return days > 60 && days <= 90
                    if (agingFilter === '90+') return days > 90
                    return true
                  })
                : data.overdueAccounts
              return filtered.length ? (
              <table className="w-full text-sm zebra-table min-w-[550px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Account</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Customer</th>
                    <th className="px-4 py-2 font-medium text-right whitespace-nowrap">Overdue</th>
                    <th className="px-4 py-2 font-medium text-center whitespace-nowrap">Days</th>
                    <th className="px-4 py-2 font-medium whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const days = a.maxOverdueDays || 0
                    const severity = days > 60 ? 'critical' : days > 30 ? 'warning' : 'attention'
                    const rowBg = severity === 'critical' ? 'bg-red-50/50 dark:bg-red-950/20' : severity === 'warning' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                    return (
                      <tr key={i} className={cn('border-b last:border-0 hover:bg-muted/40', rowBg)}>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{a.accountNumber}</td>
                        <td className="px-4 py-2 max-w-[160px]">
                          <button className="font-medium hover:text-primary text-left truncate block w-full" onClick={() => router.push(`/customers/${a.customerId}`)} title={a.customer}>
                            {a.customer}
                          </button>
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-muted-foreground">{a.mobile}</p>
                            {a.mobile && (
                              <>
                                <a href={`tel:${a.mobile}`} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" aria-label={`Call ${a.customer}`}>
                                  <Phone className="h-3 w-3" />
                                </a>
                                <a href={`https://wa.me/91${a.mobile.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 dark:text-teal-400" aria-label={`WhatsApp ${a.customer}`}>
                                  <MessageCircle className="h-3 w-3" />
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{formatMoney(a.overdueAmount)}</td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          <span className={cn(
                            'inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                            severity === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                            severity === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                            severity === 'attention' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
                          )} title={`${days} days overdue`}>
                            {days}d
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => router.push(`/collections?customer=${a.customerId}`)}>
                              <HandCoins className="h-3 w-3 mr-1" /> Collect
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => sendReminder(a)} aria-label="Send reminder" title="Send reminder">
                              <BellRing className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState message={agingFilter ? `No accounts in the ${agingFilter} day range.` : "No overdue accounts. 🎉"} icon={AlertTriangle} />
            )
            })()}
          </div>
        </SectionCard>
      </div>

      {/* Recent Activity Feed */}
      <SectionCard
        title="Recent Activity"
        description="Latest system events"
        action={<Button variant="ghost" size="sm" onClick={() => setView('audit')}>View all<ArrowRight className="h-3 w-3 ml-1" /></Button>}
      >
        <div className="max-h-72 overflow-y-auto scroll-area divide-y">
          {recentActivity.length > 0 ? recentActivity.map((log) => {
            const actionColor = log.action === 'CREATE' ? 'text-emerald-600 dark:text-emerald-400' :
              log.action === 'UPDATE' ? 'text-teal-600 dark:text-teal-400' :
              log.action === 'REVERSE' ? 'text-amber-600 dark:text-amber-400' :
              log.action === 'DELETE' ? 'text-red-600 dark:text-red-400' :
              'text-muted-foreground'
            const actionIcon = log.action === 'CREATE' ? '➕' :
              log.action === 'UPDATE' ? '✏️' :
              log.action === 'REVERSE' ? '↩️' :
              log.action === 'DELETE' ? '🗑️' :
              log.action === 'LOGIN' ? '🔑' :
              log.action === 'LOGOUT' ? '🚪' : '•'
            return (
              <div key={log.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40">
                <span className="text-base shrink-0">{actionIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', actionColor)}>{log.action}</span>
                    <Badge variant="outline" className="text-[10px]">{log.entity}</Badge>
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {log.reason || (log.newValue ? (typeof log.newValue === 'string' ? log.newValue.slice(0, 60) : '') : `${log.action.toLowerCase()} ${log.entity.toLowerCase()}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{log.user?.name || 'system'}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          }) : (
            <EmptyState message="No recent activity." icon={ScrollText} />
          )}
        </div>
      </SectionCard>
    </div>
  )
}
