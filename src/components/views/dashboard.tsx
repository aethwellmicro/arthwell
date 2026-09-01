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
import { apiFetch, formatMoney, formatMoneyCompact, formatDateTime, STATUS_COLORS } from '@/lib/format'
import { useApp } from '@/lib/store'
import { StatCard, SectionCard, EmptyState, LoadingRows, SkeletonCard } from '@/components/ui-bits'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

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
  }
  byMode: Record<string, number>
  byEmployee: { name: string; role: string; amount: number }[]
  overdueAccounts: { accountNumber: string; customer: string; customerId: string; mobile: string; overdueAmount: number }[]
  todayCollections: any[]
  trend: { month: string; amount: number }[]
  statusBreakdown: Record<string, number>
}

const MODE_COLORS: Record<string, string> = {
  CASH: '#10b981',
  UPI: '#0d9488',
  BANK: '#0891b2',
  OTHER: '#7c3aed',
}
const STATUS_PIE_COLORS = ['#10b981', '#0891b2', '#f59e0b', '#64748b', '#ef4444']

export function DashboardView() {
  const { startCollection, setView, openCustomer, user } = useApp()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [trendMonths, setTrendMonths] = useState(6)

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const d = await apiFetch<Dashboard>('/api/dashboard')
      setData(d)
    } catch (e: any) {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

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
        <Button variant="secondary" onClick={() => startCollection()}>
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

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={String(stats.totalCustomers)} animateValue={stats.totalCustomers} animateFormat={(n) => String(n)} sub={`${stats.activeCustomers} active`} icon={Users} tone="default" onClick={() => setView('customers')} />
        <StatCard label="Active Accounts" value={String(stats.totalAccounts)} animateValue={stats.totalAccounts} animateFormat={(n) => String(n)} sub="Loans disbursed" icon={Landmark} tone="info" onClick={() => setView('accounts')} />
        <StatCard label="Total Disbursed" value={formatMoneyCompact(stats.totalDisbursed)} animateValue={stats.totalDisbursed} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalDisbursed)} sub="Principal amount" icon={Banknote} tone="default" onClick={() => setView('accounts')} />
        <StatCard label="Total Collected" value={formatMoneyCompact(stats.totalCollected)} animateValue={stats.totalCollected} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalCollected)} sub={`6-mo: ${formatMoneyCompact(stats.sixMonthCollected)}`} icon={Wallet} tone="success" onClick={() => setView('collections')} />
        <StatCard label="Total Outstanding" value={formatMoneyCompact(stats.totalOutstanding)} animateValue={stats.totalOutstanding} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalOutstanding)} sub="Across all accounts" icon={TrendingUp} tone="warning" onClick={() => setView('reports')} />
        <StatCard label="Total Overdue" value={formatMoneyCompact(stats.totalOverdue)} animateValue={stats.totalOverdue} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.totalOverdue)} sub={`${stats.overdueAccountCount} accounts`} icon={AlertTriangle} tone="danger" onClick={() => setView('reports')} />
        <StatCard label="Today's Collection" value={formatMoneyCompact(stats.todayCollected)} animateValue={stats.todayCollected} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.todayCollected)} sub={`Due: ${formatMoneyCompact(stats.todayDue)}`} icon={HandCoins} tone="success" onClick={() => setView('collections')} />
        <StatCard label="Today's Pending" value={formatMoneyCompact(stats.todayPending)} animateValue={stats.todayPending} animateFormat={formatMoneyCompact} fullValue={formatMoney(stats.todayPending)} sub="Remaining due today" icon={CalendarClock} tone="warning" onClick={() => setView('reports')} />
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

      {/* Today collections + overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Today's Collections" description="Latest 10 transactions">
          <div className="max-h-96 overflow-y-auto scroll-area">
            {data.todayCollections.length ? (
              <table className="w-full text-sm zebra-table">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Receipt</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium">Mode</th>
                    <th className="px-4 py-2 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayCollections.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <p className="font-medium">{c.customerName}</p>
                        <p className="text-xs text-muted-foreground">{c.customerId}</p>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{c.receiptNumber}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatMoney(c.amount)}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{c.paymentMode}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs">{c.collectedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No collections today yet." icon={HandCoins} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Overdue Accounts" description="Top follow-up targets" action={<Button variant="ghost" size="sm" onClick={() => setView('reports')}>View all<ArrowRight className="h-3 w-3 ml-1" /></Button>}>
          <div className="max-h-96 overflow-y-auto scroll-area">
            {data.overdueAccounts.length ? (
              <table className="w-full text-sm zebra-table">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium text-right">Overdue</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overdueAccounts.map((a, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-mono text-xs">{a.accountNumber}</td>
                      <td className="px-4 py-2">
                        <button className="font-medium hover:text-primary text-left" onClick={() => openCustomer(a.customerId)}>
                          {a.customer}
                        </button>
                        <p className="text-xs text-muted-foreground">{a.mobile}</p>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-amber-600 dark:text-amber-400">{formatMoney(a.overdueAmount)}</td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" onClick={() => startCollection(a.customerId)}>
                          <HandCoins className="h-3 w-3 mr-1" /> Collect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState message="No overdue accounts. 🎉" icon={AlertTriangle} />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
