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
import { apiFetch, formatMoney, formatDateTime, STATUS_COLORS } from '@/lib/format'
import { useApp } from '@/lib/store'
import { StatCard, SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
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
  const { startCollection, setView, openCustomer } = useApp()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const d = await apiFetch<Dashboard>('/api/dashboard')
        if (!cancel) setData(d)
      } catch (e: any) {
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (loading) return <LoadingRows rows={6} />
  if (!data) return <EmptyState message="Could not load dashboard data." />

  const { stats } = data
  const modeData = Object.entries(data.byMode).map(([k, v]) => ({ name: k, value: v }))
  const statusData = Object.entries(data.statusBreakdown).map(([k, v]) => ({ name: k, value: v }))

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
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={String(stats.totalCustomers)} sub={`${stats.activeCustomers} active`} icon={Users} tone="default" />
        <StatCard label="Active Accounts" value={String(stats.totalAccounts)} sub="Loans disbursed" icon={Landmark} tone="info" />
        <StatCard label="Total Disbursed" value={formatMoney(stats.totalDisbursed)} sub="Principal amount" icon={Banknote} tone="default" />
        <StatCard label="Total Collected" value={formatMoney(stats.totalCollected)} sub={`6-mo: ${formatMoney(stats.sixMonthCollected)}`} icon={Wallet} tone="success" />
        <StatCard label="Total Outstanding" value={formatMoney(stats.totalOutstanding)} sub="Across all accounts" icon={TrendingUp} tone="warning" />
        <StatCard label="Total Overdue" value={formatMoney(stats.totalOverdue)} sub={`${stats.overdueAccountCount} accounts`} icon={AlertTriangle} tone="danger" />
        <StatCard label="Today's Collection" value={formatMoney(stats.todayCollected)} sub={`Due: ${formatMoney(stats.todayDue)}`} icon={HandCoins} tone="success" />
        <StatCard label="Today's Pending" value={formatMoney(stats.todayPending)} sub="Remaining due today" icon={CalendarClock} tone="warning" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Collection Trend" description="Last 6 months" className="lg:col-span-2">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
          <div className="h-64 p-4">
            {statusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`} labelLine={false} style={{ fontSize: 11 }}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
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
              <table className="w-full text-sm">
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
              <table className="w-full text-sm">
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
