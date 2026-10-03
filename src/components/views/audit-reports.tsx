'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ScrollText,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Scale,
  BarChart3,
  Landmark,
  BookOpen,
  CalendarCheck,
  FileText,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, formatRelativeTime, downloadCSV } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionCard, EmptyState, LoadingRows, StatCard } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Audit Logs Types & Helpers ──────────────────────────────────────────────

interface AuditLog {
  id: string
  action: string
  entity: string
  entityId?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  createdAt: string
  user?: { name: string; email: string; role: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  UPDATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  REVERSE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LOGIN: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  LOGOUT: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const ACTION_BORDERS: Record<string, string> = {
  CREATE: 'border-l-emerald-500',
  UPDATE: 'border-l-teal-500',
  DELETE: 'border-l-red-500',
  REVERSE: 'border-l-amber-500',
  LOGIN: 'border-l-slate-400',
  LOGOUT: 'border-l-slate-400',
}

const ACTION_ICONS: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  REVERSE: '↩️',
  LOGIN: '🔑',
  LOGOUT: '🚪',
}

// ─── Cash Book Entry type ─────────────────────────────────────────────────────

interface CashEntry {
  date: string
  particulars: string
  voucherNo: string
  narration: string
  debit: number
  credit: number
  balance: number
  type: string
}

const ENTRY_TYPE_COLORS: Record<string, string> = {
  COLLECTION: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INVESTMENT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  DISBURSEMENT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  EXPENSE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  BANK_DEPOSIT: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditReportsView() {
  const [activeTab, setActiveTab] = useState('audit-logs')

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white p-5 shadow-lg">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Audit &amp; Financial Reports</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Complete audit trail, statutory financial statements, and cash reconciliation for external auditors
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CalendarCheck className="h-4 w-4" />
            <span>Generated: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/60">
          <TabsTrigger value="audit-logs" className="gap-1.5 text-xs">
            <ScrollText className="h-3.5 w-3.5" /> Audit Trail
          </TabsTrigger>
          <TabsTrigger value="cash-book" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Cash Book
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="gap-1.5 text-xs">
            <Scale className="h-3.5 w-3.5" /> Trial Balance
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Profit &amp; Loss
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="gap-1.5 text-xs">
            <Landmark className="h-3.5 w-3.5" /> Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="bank-reconciliation" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" /> Bank Reconciliation
          </TabsTrigger>
          <TabsTrigger value="eod-history" className="gap-1.5 text-xs">
            <CalendarCheck className="h-3.5 w-3.5" /> EOD History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit-logs">
          <AuditLogsSection />
        </TabsContent>

        <TabsContent value="cash-book">
          <CashBookSection />
        </TabsContent>

        <TabsContent value="trial-balance">
          <AccountingReportSection reportType="trial-balance" />
        </TabsContent>

        <TabsContent value="profit-loss">
          <AccountingReportSection reportType="profit-loss" />
        </TabsContent>

        <TabsContent value="balance-sheet">
          <AccountingReportSection reportType="balance-sheet" />
        </TabsContent>

        <TabsContent value="bank-reconciliation">
          <AccountingReportSection reportType="bank-reconciliation" />
        </TabsContent>

        <TabsContent value="eod-history">
          <EodHistorySection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Audit Logs Section ───────────────────────────────────────────────────────

function AuditLogsSection() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('ALL')
  const [entity, setEntity] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (action !== 'ALL') params.set('action', action)
      if (entity !== 'ALL') params.set('entity', entity)
      if (from) params.set('from', from)
      if (to) params.set('to', to + 'T23:59:59')
      const data = await apiFetch<{ items: AuditLog[] }>(`/api/audit-logs?${params}`)
      setItems(data.items)
      setPage(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [action, entity, from, to])

  useEffect(() => { load() }, [load])

  const filteredItems = search
    ? items.filter((l) => {
        const q = search.toLowerCase()
        return (
          (l.user?.name || '').toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entity.toLowerCase().includes(q) ||
          (l.reason || '').toLowerCase().includes(q) ||
          (l.newValue || '').toLowerCase().includes(q) ||
          (l.entityId || '').toLowerCase().includes(q)
        )
      })
    : items

  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  function prettyJson(s?: string | null) {
    if (!s) return null
    try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
  }

  function exportCSV() {
    if (!filteredItems.length) return toast.info('No audit logs to export')
    downloadCSV(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, filteredItems.map((l) => ({
      timestamp: formatDateTime(l.createdAt),
      user: l.user?.name || 'system',
      email: l.user?.email || '',
      role: l.user?.role || '',
      action: l.action,
      entity: l.entity,
      entityId: l.entityId || '',
      reason: l.reason || '',
      oldValue: l.oldValue || '',
      newValue: l.newValue || '',
    })))
    toast.success('Audit trail exported to CSV')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search user, entity, reason…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="REVERSE">Reverse</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Entity</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Entities</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="ACCOUNT">Account</SelectItem>
              <SelectItem value="COLLECTION">Collection</SelectItem>
              <SelectItem value="BUSINESS_DATE">Business Date</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INVESTMENT">Investment</SelectItem>
              <SelectItem value="BANK_DEPOSIT">Bank Deposit</SelectItem>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="RECEIPT">Receipt</SelectItem>
              <SelectItem value="SETTINGS">Settings</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!filteredItems.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <SectionCard title={`Audit Trail (${filteredItems.length} records)`} description="Immutable chronological activity log — all actions are permanently recorded">
        {loading ? (
          <LoadingRows rows={6} />
        ) : filteredItems.length === 0 ? (
          <EmptyState message="No audit entries for the selected filters." icon={ScrollText} />
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto scroll-area divide-y">
              {paginatedItems.map((l) => {
                const isOpen = expanded === l.id
                const oldJ = prettyJson(l.oldValue)
                const newJ = prettyJson(l.newValue)
                const hasDetail = !!(oldJ || newJ || l.reason)
                return (
                  <div key={l.id} className={cn('px-4 py-2.5 hover:bg-muted/40 border-l-4', ACTION_BORDERS[l.action] || 'border-l-slate-300')}>
                    <button
                      className="w-full flex items-center gap-3 text-left"
                      onClick={() => setExpanded(hasDetail ? (isOpen ? null : l.id) : null)}
                    >
                      {hasDetail ? (
                        isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : <span className="w-4" />}
                      <span className="text-base shrink-0" aria-hidden>{ACTION_ICONS[l.action] || '•'}</span>
                      <Badge className={cn(ACTION_COLORS[l.action] || 'bg-slate-200 text-slate-700')}>{l.action}</Badge>
                      <Badge variant="outline">{l.entity}</Badge>
                      {l.entityId && <span className="font-mono text-xs text-muted-foreground hidden md:inline">{l.entityId.slice(0, 12)}</span>}
                      <span className="text-sm flex-1 truncate">
                        {l.reason || (newJ ? newJ.slice(0, 80) : l.action.toLowerCase() + ' ' + l.entity.toLowerCase())}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:block">{l.user?.name || 'system'}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap" title={formatDateTime(l.createdAt)}>
                        {formatRelativeTime(l.createdAt)}
                      </span>
                    </button>
                    {isOpen && hasDetail && (
                      <div className="mt-2 ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {l.reason && (
                          <div className="md:col-span-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs">
                            <span className="font-medium text-amber-800 dark:text-amber-300">Reason: </span>{l.reason}
                          </div>
                        )}
                        {oldJ && (
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">Old Value</p>
                            <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto scroll-area whitespace-pre-wrap">{oldJ}</pre>
                          </div>
                        )}
                        {newJ && (
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">New Value</p>
                            <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto scroll-area whitespace-pre-wrap">{newJ}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filteredItems.length > pageSize && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filteredItems.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              />
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Cash Book Section ────────────────────────────────────────────────────────

function CashBookSection() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const d = await apiFetch<any>(`/api/reports/cashbook?${params}`)
      setData(d)
      setPage(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  function exportCSV() {
    if (!data?.entries?.length) return toast.info('No cash book entries to export')
    downloadCSV(`cash-book-${new Date().toISOString().slice(0, 10)}.csv`, (data.entries as CashEntry[]).map((e) => ({
      date: e.date,
      voucherNo: e.voucherNo,
      type: e.type,
      particulars: e.particulars,
      narration: e.narration,
      debit: e.debit.toFixed(2),
      credit: e.credit.toFixed(2),
      balance: e.balance.toFixed(2),
    })))
    toast.success('Cash Book exported to CSV')
  }

  const entries: CashEntry[] = data?.entries || []
  const paginated = entries.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">From Date</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To Date</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Opening Balance" value={formatMoney(data.openingBalance || 0)} icon={Wallet} />
          <StatCard label="Total Cash Receipts (Dr)" value={formatMoney(data.totalDebits || 0)} icon={TrendingUp} tone="success" />
          <StatCard label="Total Cash Payments (Cr)" value={formatMoney(data.totalCredits || 0)} icon={TrendingDown} tone="warning" />
          <StatCard label="Closing Balance" value={formatMoney(data.closingBalance || 0)} icon={Wallet} tone={data.closingBalance >= 0 ? 'success' : 'danger'} />
        </div>
      )}

      {/* Cash Book Ledger */}
      <SectionCard
        title="Cash Book — Dr / Cr Ledger"
        description={data ? `${data.entryCount} entries${data.dateFrom ? ` | ${data.dateFrom} to ${data.dateTo || 'today'}` : ''}` : 'Cash receipts and payments register'}
      >
        {loading ? (
          <LoadingRows rows={8} />
        ) : !data || entries.length === 0 ? (
          <EmptyState message="No cash transactions found for the selected date range." icon={BookOpen} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Voucher No.</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Particulars</th>
                    <th className="px-3 py-2.5 font-semibold max-w-[220px]">Narration</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-emerald-700 dark:text-emerald-400">Dr (Receipts)</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-rose-700 dark:text-rose-400">Cr (Payments)</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Opening Balance row */}
                  {page === 1 && (
                    <tr className="bg-slate-50 dark:bg-slate-900/50 font-semibold">
                      <td className="px-3 py-2 text-muted-foreground" colSpan={5}>Opening Balance{data.dateFrom ? ` as at ${data.dateFrom}` : ''}</td>
                      <td className="px-3 py-2 text-right"></td>
                      <td className="px-3 py-2 text-right"></td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatMoney(data.openingBalance)}</td>
                    </tr>
                  )}
                  {paginated.map((e, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{e.date}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-primary whitespace-nowrap">{e.voucherNo}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn('text-[10px]', ENTRY_TYPE_COLORS[e.type] || 'bg-slate-100 text-slate-700')}>
                          {e.type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium max-w-[160px] truncate" title={e.particulars}>{e.particulars}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={e.narration}>{e.narration}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        {e.debit > 0 ? formatMoney(e.debit) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700 dark:text-rose-400 font-semibold">
                        {e.credit > 0 ? formatMoney(e.credit) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatMoney(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-bold border-t-2">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right text-sm">Closing Balance:</td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{formatMoney(data.totalDebits)}</td>
                    <td className="px-3 py-3 text-right font-mono text-rose-700 dark:text-rose-400">{formatMoney(data.totalCredits)}</td>
                    <td className="px-3 py-3 text-right font-mono text-primary text-base">{formatMoney(data.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {entries.length > pageSize && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={entries.length}
                onPageChange={setPage}
                onPageSizeChange={() => {}}
              />
            )}
          </>
        )}
      </SectionCard>

      {/* EOD Daily Summary embedded in Cash Book */}
      {data?.eodSummary?.length > 0 && (
        <SectionCard title="Day-wise EOD Summary" description="Business date reconciliation history within the selected range">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-3 py-2.5 font-semibold">Business Date</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Opening (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Closing (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Actual (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Difference</th>
                  <th className="px-3 py-2.5 font-semibold">Reconciliation</th>
                  <th className="px-3 py-2.5 font-semibold">Closed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.eodSummary.map((e: any) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-medium">{e.businessDate}</td>
                    <td className="px-3 py-2">
                      <Badge className={e.status === 'CLOSED' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(e.openingCash)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(e.closingCash)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(e.actualCashInHand)}</td>
                    <td className={cn('px-3 py-2 text-right font-mono font-semibold', e.cashDifference === 0 ? 'text-emerald-600' : 'text-amber-600')}>
                      {e.cashDifference === 0 ? '₹0.00' : formatMoney(e.cashDifference)}
                    </td>
                    <td className="px-3 py-2">
                      {e.reconciliationStatus === 'BALANCED' ? (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Balanced</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> {e.reconciliationStatus?.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.closedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ─── Accounting Reports Section ───────────────────────────────────────────────

function AccountingReportSection({ reportType }: { reportType: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch<any>(`/api/reports/accounting?report=${reportType}`)
      setData(d)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [reportType])

  useEffect(() => { load() }, [load])

  const reportTitles: Record<string, string> = {
    'trial-balance': 'Trial Balance',
    'profit-loss': 'Profit & Loss Statement',
    'balance-sheet': 'Balance Sheet',
    'bank-reconciliation': 'Bank Reconciliation Statement (BRS)',
  }

  const reportDescriptions: Record<string, string> = {
    'trial-balance': 'Double-entry bookkeeping — total debits must equal total credits',
    'profit-loss': 'Operating income minus expenses — net profitability statement',
    'balance-sheet': 'Assets = Liabilities + Equity — financial position at a point in time',
    'bank-reconciliation': 'Reconciliation of book balance against bank statement balance',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print / PDF
        </Button>
      </div>

      <SectionCard
        title={reportTitles[reportType] || reportType}
        description={reportDescriptions[reportType]}
      >
        {loading ? (
          <LoadingRows rows={6} />
        ) : !data ? (
          <EmptyState message="Unable to load report data." icon={FileText} />
        ) : reportType === 'trial-balance' ? (
          <TrialBalanceDisplay data={data} />
        ) : reportType === 'profit-loss' ? (
          <ProfitLossDisplay data={data} />
        ) : reportType === 'balance-sheet' ? (
          <BalanceSheetDisplay data={data} />
        ) : reportType === 'bank-reconciliation' ? (
          <BankReconciliationDisplay data={data} />
        ) : null}
      </SectionCard>
    </div>
  )
}

function TrialBalanceDisplay({ data }: { data: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs text-muted-foreground border-b">
            <th className="px-4 py-3 font-semibold">Account Code</th>
            <th className="px-4 py-3 font-semibold">Account Description</th>
            <th className="px-4 py-3 font-semibold text-right text-emerald-700 dark:text-emerald-400">Debit (₹)</th>
            <th className="px-4 py-3 font-semibold text-right text-rose-700 dark:text-rose-400">Credit (₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(data.items || []).map((it: any, i: number) => (
            <tr key={i} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{it.code}</td>
              <td className="px-4 py-2.5 font-medium">{it.account}</td>
              <td className="px-4 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                {it.debit > 0 ? formatMoney(it.debit) : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-rose-700 dark:text-rose-400">
                {it.credit > 0 ? formatMoney(it.credit) : <span className="text-muted-foreground/40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-bold border-t-2">
          <tr>
            <td colSpan={2} className="px-4 py-3 text-right text-sm">Grand Total:</td>
            <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400 text-base">{formatMoney(data.totalDebit || 0)}</td>
            <td className="px-4 py-3 text-right font-mono text-rose-700 dark:text-rose-400 text-base">{formatMoney(data.totalCredit || 0)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right text-xs">
              {data.reconciled ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
                  <CheckCircle2 className="h-4 w-4" /> BALANCED — Total Debit = Total Credit
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center justify-end gap-1">
                  <AlertTriangle className="h-4 w-4" /> Variance: {formatMoney(data.difference || 0)}
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ProfitLossDisplay({ data }: { data: any }) {
  const isProfit = (data.netProfit || 0) >= 0
  return (
    <div className="space-y-4 p-2 max-w-2xl mx-auto">
      {/* Income */}
      <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 p-5 space-y-2.5">
        <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide border-b border-emerald-200 dark:border-emerald-800 pb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Income
        </h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Interest Income from Loans</span><span className="font-mono font-semibold">{formatMoney(data.income?.interestIncome || 0)}</span></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Processing Fees</span><span className="font-mono font-semibold">{formatMoney(data.income?.processingFees || 0)}</span></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Insurance Premium &amp; Other Income</span><span className="font-mono font-semibold">{formatMoney(data.income?.insuranceIncome || 0)}</span></div>
          <div className="flex justify-between py-2 border-t border-emerald-200 dark:border-emerald-800 font-bold text-emerald-700 dark:text-emerald-400">
            <span>Total Income</span><span className="font-mono text-base">{formatMoney(data.income?.totalIncome || 0)}</span>
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="rounded-xl border bg-rose-50 dark:bg-rose-950/20 p-5 space-y-2.5">
        <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide border-b border-rose-200 dark:border-rose-800 pb-2 flex items-center gap-2">
          <TrendingDown className="h-4 w-4" /> Expenses
        </h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Operating &amp; Administrative Expenses</span><span className="font-mono font-semibold">{formatMoney(data.expenses?.operatingExpenses || 0)}</span></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Interest &amp; Capital Cost</span><span className="font-mono font-semibold">{formatMoney(data.expenses?.interestExpense || 0)}</span></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Other Miscellaneous Expenses</span><span className="font-mono font-semibold">{formatMoney(data.expenses?.otherExpenses || 0)}</span></div>
          <div className="flex justify-between py-2 border-t border-rose-200 dark:border-rose-800 font-bold text-rose-700 dark:text-rose-400">
            <span>Total Expenses</span><span className="font-mono text-base">{formatMoney(data.expenses?.totalExpenses || 0)}</span>
          </div>
        </div>
      </div>

      {/* Net P&L */}
      <div className={cn('rounded-xl border p-5 flex items-center justify-between', isProfit ? 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-300' : 'bg-rose-100 dark:bg-rose-950/30 border-rose-300')}>
        <div>
          <p className="text-base font-bold">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Profit Margin: {data.profitMarginPercent ? `${data.profitMarginPercent.toFixed(2)}%` : '—'}
          </p>
        </div>
        <p className={cn('text-2xl font-bold font-mono', isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700')}>
          {formatMoney(Math.abs(data.netProfit || 0))}
        </p>
      </div>
    </div>
  )
}

function BalanceSheetDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assets */}
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-5 space-y-2.5">
          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide border-b border-blue-200 dark:border-blue-800 pb-2 flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Assets
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Cash in Hand (Vault)</span><span className="font-mono font-semibold">{formatMoney(data.assets?.cashInHand || 0)}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Bank Accounts</span><span className="font-mono font-semibold">{formatMoney(data.assets?.bankAccounts || 0)}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Loan Portfolio Receivables</span><span className="font-mono font-semibold">{formatMoney(data.assets?.loanReceivables || 0)}</span></div>
            <div className="flex justify-between py-2 border-t border-blue-200 dark:border-blue-800 font-bold text-blue-700 dark:text-blue-400 text-base">
              <span>Total Assets</span><span className="font-mono">{formatMoney(data.assets?.totalAssets || 0)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities + Equity */}
        <div className="rounded-xl border bg-purple-50 dark:bg-purple-950/20 p-5 space-y-2.5">
          <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide border-b border-purple-200 dark:border-purple-800 pb-2 flex items-center gap-2">
            <Scale className="h-4 w-4" /> Liabilities &amp; Equity
          </h4>
          <div className="space-y-1.5 text-sm">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-1">Liabilities</p>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Customer Compulsory Savings</span><span className="font-mono font-semibold">{formatMoney(data.liabilities?.customerSavings || 0)}</span></div>
            <p className="text-[10px] uppercase text-muted-foreground font-semibold mt-2 pt-1 border-t">Equity</p>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Invested Capital</span><span className="font-mono font-semibold">{formatMoney(data.equity?.investedCapital || 0)}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Retained Earnings / Current Profit</span><span className="font-mono font-semibold">{formatMoney(data.equity?.retainedEarnings || 0)}</span></div>
            <div className="flex justify-between py-2 border-t border-purple-200 dark:border-purple-800 font-bold text-purple-700 dark:text-purple-400 text-base">
              <span>Total Liabilities &amp; Equity</span><span className="font-mono">{formatMoney(data.totalLiabilitiesAndEquity || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation */}
      <div className={cn('rounded-xl border p-4 flex items-center justify-between text-sm', data.reconciled ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300')}>
        <span className="font-medium text-muted-foreground">Balance Sheet Reconciliation:</span>
        {data.reconciled ? (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> BALANCED — Total Assets = Liabilities + Equity
          </span>
        ) : (
          <span className="font-mono font-bold text-amber-600 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Variance: {formatMoney(data.variance || 0)}
          </span>
        )}
      </div>
    </div>
  )
}

function BankReconciliationDisplay({ data }: { data: any }) {
  return (
    <div className="max-w-xl mx-auto space-y-3 p-2">
      <div className="rounded-xl border bg-muted/20 p-5 space-y-0">
        <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-3 tracking-wide">Bank Reconciliation Statement</h4>
        <div className="space-y-0.5 text-sm">
          {[
            { label: '1. Bank Balance as per Books (Cash Ledger)', value: data.bookBalance || 0, bold: true },
            { label: '2. Add: Deposits in Transit (not yet cleared)', value: data.depositsInTransit || 0, plus: true },
            { label: '3. Less: Outstanding Cheques / Pending Transfers', value: data.outstandingCheques || 0, minus: true },
            { label: '4. Less: Bank Charges not entered in Books', value: data.bankCharges || 0, minus: true },
          ].map((row, i) => (
            <div key={i} className={cn('flex justify-between py-2.5 border-b last:border-b-0', row.bold && 'font-semibold')}>
              <span className={row.plus ? 'text-emerald-700 dark:text-emerald-400' : row.minus ? 'text-rose-700 dark:text-rose-400' : ''}>{row.label}</span>
              <span className={cn('font-mono font-medium', row.plus ? 'text-emerald-700 dark:text-emerald-400' : row.minus ? 'text-rose-700 dark:text-rose-400' : '')}>
                {row.plus ? '+' : row.minus ? '−' : ''} {formatMoney(row.value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-3 border-t-2 font-bold text-primary text-base">
            <span>Reconciled Bank Balance</span>
            <span className="font-mono">{formatMoney(data.reconciledBalance || 0)}</span>
          </div>
          <div className={cn('flex justify-between py-2.5 rounded-lg px-3 -mx-3', data.difference === 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30')}>
            <span className="font-medium">Reconciliation Difference:</span>
            <span className={cn('font-mono font-bold', data.difference === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600')}>
              {data.difference === 0 ? '₹0.00 — RECONCILED ✓' : formatMoney(data.difference)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── EOD History Section ──────────────────────────────────────────────────────

function EodHistorySection() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch<{ items: any[] }>('/api/business-date/eod?history=true')
      setItems(d.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function exportCSV() {
    if (!items.length) return toast.info('No EOD history to export')
    downloadCSV(`eod-history-${new Date().toISOString().slice(0, 10)}.csv`, items.map((r) => ({
      businessDate: r.businessDate,
      status: r.status,
      openingCash: r.openingCash.toFixed(2),
      closingCash: r.closingCash.toFixed(2),
      actualCashInHand: r.actualCashInHand.toFixed(2),
      cashDifference: r.cashDifference.toFixed(2),
      reconciliationStatus: r.reconciliationStatus,
      openedBy: r.openedBy?.name || '',
      closedBy: r.closedBy?.name || '',
      collections: r._count?.collections || 0,
      accounts: r._count?.accounts || 0,
      bankDeposits: r._count?.bankDeposits || 0,
    })))
    toast.success('EOD history exported to CSV')
  }

  const totalDays = items.length
  const balancedDays = items.filter((i) => i.reconciliationStatus === 'BALANCED').length
  const differencesDays = items.filter((i) => i.reconciliationStatus !== 'BALANCED').length

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Business Days" value={String(totalDays)} icon={CalendarCheck} />
          <StatCard label="Balanced Days" value={String(balancedDays)} icon={CheckCircle2} tone="success" />
          <StatCard label="Days with Variance" value={String(differencesDays)} icon={AlertTriangle} tone={differencesDays > 0 ? 'warning' : 'success'} />
          <StatCard
            label="Total Closing Cash"
            value={items.length > 0 ? formatMoney(items[0].closingCash) : '₹0'}
            icon={Wallet}
            sub="Latest closed day"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!items.length}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      <SectionCard title={`EOD Closing History (${items.length} days)`} description="Day End reconciliation and cash handover records for audit">
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No closed business dates found." icon={CalendarCheck} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-muted-foreground border-b">
                  <th className="px-3 py-3 font-semibold">Business Date</th>
                  <th className="px-3 py-3 font-semibold text-right">Opening (₹)</th>
                  <th className="px-3 py-3 font-semibold text-right">Closing (₹)</th>
                  <th className="px-3 py-3 font-semibold text-right">Actual (₹)</th>
                  <th className="px-3 py-3 font-semibold text-right">Difference</th>
                  <th className="px-3 py-3 font-semibold">Reconciliation</th>
                  <th className="px-3 py-3 font-semibold text-center">Collections</th>
                  <th className="px-3 py-3 font-semibold text-center">Accounts</th>
                  <th className="px-3 py-3 font-semibold text-center">Deposits</th>
                  <th className="px-3 py-3 font-semibold">Opened By</th>
                  <th className="px-3 py-3 font-semibold">Closed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-mono font-semibold">{r.businessDate}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatMoney(r.openingCash)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(r.closingCash)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatMoney(r.actualCashInHand)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-mono font-bold', r.cashDifference === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600')}>
                      {r.cashDifference === 0 ? '—' : formatMoney(r.cashDifference)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={r.reconciliationStatus === 'BALANCED'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]'
                      }>
                        {r.reconciliationStatus?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{r._count?.collections || 0}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{r._count?.accounts || 0}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{r._count?.bankDeposits || 0}</td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[100px]">{r.openedBy?.name || '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[100px]">{r.closedBy?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
