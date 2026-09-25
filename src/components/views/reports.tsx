'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  Users,
  UserCog,
  CreditCard,
  AlertTriangle,
  Landmark,
  Scale,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDate, formatDateTime, STATUS_COLORS, ROLE_LABELS, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionCard, EmptyState, LoadingRows, StatCard } from '@/components/ui-bits'
import { PrintReport } from '@/components/print-report'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ReportType =
  | 'daily' | 'weekly' | 'monthly' | 'sixmonthly' | 'yearly'
  | 'customer' | 'employee' | 'paymentmode'
  | 'outstanding' | 'overdue' | 'accountstatus' | 'reconciliation'
  | 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'bank-reconciliation'

const REPORTS: { key: ReportType; label: string; icon: any; group: string }[] = [
  { key: 'daily', label: 'Daily', icon: Calendar, group: 'Period' },
  { key: 'weekly', label: 'Weekly', icon: Calendar, group: 'Period' },
  { key: 'monthly', label: 'Monthly', icon: Calendar, group: 'Period' },
  { key: 'sixmonthly', label: 'Six-Month', icon: Calendar, group: 'Period' },
  { key: 'yearly', label: 'Yearly', icon: Calendar, group: 'Period' },
  { key: 'customer', label: 'Customer-wise', icon: Users, group: 'Group' },
  { key: 'employee', label: 'Employee-wise', icon: UserCog, group: 'Group' },
  { key: 'paymentmode', label: 'Payment Mode', icon: CreditCard, group: 'Group' },
  { key: 'outstanding', label: 'Outstanding', icon: Landmark, group: 'Balance' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, group: 'Balance' },
  { key: 'trial-balance', label: 'Trial Balance', icon: Scale, group: 'Accounting' },
  { key: 'profit-loss', label: 'Profit & Loss', icon: BarChart3, group: 'Accounting' },
  { key: 'balance-sheet', label: 'Balance Sheet', icon: Landmark, group: 'Accounting' },
  { key: 'bank-reconciliation', label: 'Bank Reconciliation', icon: Landmark, group: 'Accounting' },
  { key: 'accountstatus', label: 'Account Status', icon: BarChart3, group: 'Status' },
  { key: 'reconciliation', label: 'Reconciliation', icon: Scale, group: 'Status' },
]

export function ReportsView() {
  const [type, setType] = useState<ReportType>('daily')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [paymentMode, setPaymentMode] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('SUCCESSFUL')
  const [area, setArea] = useState('')
  const [employees, setEmployees] = useState<any[]>([])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch<{ items: any[] }>('/api/employees').then((d) => setEmployees(d.items)).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      if (type === 'trial-balance' || type === 'profit-loss' || type === 'balance-sheet' || type === 'bank-reconciliation') {
        const d = await apiFetch<any>(`/api/reports/accounting?report=${type}`)
        setData(d)
      } else {
        const params = new URLSearchParams({ type })
        if (from) params.set('from', from)
        if (to) params.set('to', to + 'T23:59:59')
        if (employeeId) params.set('employeeId', employeeId)
        if (paymentMode !== 'ALL') params.set('paymentMode', paymentMode)
        if (statusFilter !== 'ALL') params.set('status', statusFilter)
        if (area) params.set('area', area)
        const d = await apiFetch<any>(`/api/reports?${params}`)
        setData(d)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [type, from, to, employeeId, paymentMode, statusFilter, area])

  function exportCSV() {
    if (!data) return
    const rows = (data.items || []).map((it: any) => {
      const o: any = {}
      for (const [k, v] of Object.entries(it)) {
        if (v instanceof Date) o[k] = formatDate(v)
        else if (typeof v === 'object' && v !== null) o[k] = JSON.stringify(v)
        else o[k] = v
      }
      return o
    })
    downloadCSV(`${type}-report-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success('Exported to CSV')
  }

  function printReport() {
    setTimeout(() => window.print(), 200)
  }

  const report = REPORTS.find((r) => r.key === type)!
  const isBalance = type === 'outstanding' || type === 'overdue'
  const isGrouped = type === 'customer' || type === 'employee' || type === 'paymentmode' || type === 'accountstatus' || type === 'reconciliation'
  const showDateFilters = !isBalance && type !== 'accountstatus'

  // Determine columns for print layout
  const printColumns = useMemo(() => {
    type ColDef = { key: string; label: string; align?: 'left' | 'right' | 'center' }
    
    if (isBalance) {
      const cols: ColDef[] = [
        { key: 'accountNumber', label: 'Account' },
        { key: 'customerName', label: 'Customer' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'totalPayable', label: 'Payable', align: 'right' },
        { key: 'paid', label: 'Paid', align: 'right' },
        { key: 'outstanding', label: 'Outstanding', align: 'right' },
      ]
      if (type === 'overdue') {
        cols.push({ key: 'overdueAmount', label: 'Overdue', align: 'right' })
        cols.push({ key: 'overdueDays', label: 'Days', align: 'center' })
      }
      cols.push({ key: 'status', label: 'Status' })
      return cols
    }
    if (isGrouped) {
      const cols: ColDef[] = [{ key: 'key', label: type === 'customer' ? 'Customer' : type === 'employee' ? 'Employee' : type === 'paymentmode' ? 'Mode' : type === 'accountstatus' ? 'Status' : 'Collector' }]
      cols.push({ key: 'count', label: 'Count', align: 'right' })
      cols.push({ key: 'total', label: 'Total', align: 'right' })
      if (type === 'accountstatus') {
        cols.push({ key: 'disbursed', label: 'Disbursed', align: 'right' })
        cols.push({ key: 'payable', label: 'Payable', align: 'right' })
      }
      if (type === 'reconciliation') {
        cols.push({ key: 'cash', label: 'Cash', align: 'right' })
        cols.push({ key: 'upi', label: 'UPI', align: 'right' })
        cols.push({ key: 'bank', label: 'Bank', align: 'right' })
      }
      return cols
    }
    const defaultCols: ColDef[] = [
      { key: 'receiptNumber', label: 'Receipt' },
      { key: 'collectionDate', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'amount', label: 'Amount', align: 'right' },
      { key: 'paymentMode', label: 'Mode' },
      { key: 'collectedBy', label: 'Collector' },
      { key: 'status', label: 'Status' },
    ]
    return defaultCols
  }, [type, isBalance, isGrouped])

  return (
    <div className="space-y-4">
      {/* Report type selector */}
      <div className="flex flex-wrap gap-1.5 no-print">
        {REPORTS.map((r) => {
          const Icon = r.icon
          return (
            <Button
              key={r.key}
              variant={type === r.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType(r.key)}
              className="gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" /> {r.label}
            </Button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5 sm:gap-3 no-print">
        {showDateFilters && (
          <>
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-[140px]" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-[140px]" />
            </div>
          </>
        )}
        {type !== 'employee' && type !== 'accountstatus' && (
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground">Employee</Label>
            <Select value={employeeId || 'ALL'} onValueChange={(v) => setEmployeeId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {(type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'sixmonthly' || type === 'yearly' || type === 'customer' || type === 'employee' || type === 'paymentmode' || type === 'reconciliation') && (
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {type === 'outstanding' || type === 'overdue' ? (
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Area</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area filter" className="w-full sm:w-[140px]" />
          </div>
        ) : null}
        <div className="col-span-2 sm:ml-auto flex items-center gap-2 justify-end pt-1 sm:pt-0">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data} className="flex-1 sm:flex-initial"><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={printReport} disabled={!data} className="flex-1 sm:flex-initial"><Printer className="h-4 w-4 mr-1" /> PDF</Button>
        </div>
      </div>

      {/* Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Amount" value={formatMoney(data.summary.total || 0)} sub={`${data.summary.count || 0} records`} icon={BarChart3} />
          <StatCard label="Cash" value={formatMoney(data.summary.cashTotal || 0)} icon={CreditCard} tone="success" />
          <StatCard label="UPI" value={formatMoney(data.summary.upiTotal || 0)} icon={CreditCard} tone="info" />
          <StatCard label="Bank" value={formatMoney(data.summary.bankTotal || 0)} icon={CreditCard} tone="default" />
          {isBalance && (
            <>
              <StatCard label={type === 'overdue' ? 'Overdue Total' : 'Outstanding Total'} value={formatMoney(data.summary.total || 0)} icon={AlertTriangle} tone="warning" />
              <StatCard label="Accounts" value={String(data.summary.count || 0)} icon={Landmark} />
            </>
          )}
        </div>
      )}

      {/* Data table */}
      <SectionCard title={report.label + ' Report'} description={data?.summary ? `From ${formatDate(data.summary.dateFrom)} to ${formatDate(data.summary.dateTo)}` : undefined}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : !data ? (
          <EmptyState message="No records found for the selected report / filters." icon={BarChart3} />
        ) : type === 'trial-balance' ? (
          <div className="max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[650px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Account Code</th>
                  <th className="px-3 py-2 font-medium">Account Description</th>
                  <th className="px-3 py-2 font-medium text-right">Debit (₹)</th>
                  <th className="px-3 py-2 font-medium text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((it: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{it.code}</td>
                    <td className="px-3 py-2 font-medium">{it.account}</td>
                    <td className="px-3 py-2 text-right font-mono">{it.debit > 0 ? formatMoney(it.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{it.credit > 0 ? formatMoney(it.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-bold sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right">Total:</td>
                  <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-mono">{formatMoney(data.totalDebit || 0)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-mono">{formatMoney(data.totalCredit || 0)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-3 py-1.5 text-right text-xs text-muted-foreground">Reconciliation Status:</td>
                  <td colSpan={2} className="px-3 py-1.5 text-right font-mono text-xs">
                    {data.reconciled ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ BALANCED (Total Debit = Total Credit)</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Variance: {formatMoney(data.difference || 0)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : type === 'profit-loss' ? (
          <div className="space-y-4 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide border-b pb-1">Operating &amp; Financial Income</h4>
                <div className="flex justify-between text-xs py-1"><span>Interest Income from Loans:</span><span className="font-mono font-medium">{formatMoney(data.income?.interestIncome || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Processing Fees:</span><span className="font-mono font-medium">{formatMoney(data.income?.processingFees || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Insurance Premium / Other:</span><span className="font-mono font-medium">{formatMoney(data.income?.insuranceIncome || 0)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t text-emerald-600"><span>Total Income:</span><span className="font-mono">{formatMoney(data.income?.totalIncome || 0)}</span></div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide border-b pb-1">Operating &amp; Financial Expenses</h4>
                <div className="flex justify-between text-xs py-1"><span>Operating &amp; Administrative:</span><span className="font-mono font-medium">{formatMoney(data.expenses?.operatingExpenses || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Interest &amp; Capital Cost:</span><span className="font-mono font-medium">{formatMoney(data.expenses?.interestExpense || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Other Expenses:</span><span className="font-mono font-medium">{formatMoney(data.expenses?.otherExpenses || 0)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t text-rose-600"><span>Total Expenses:</span><span className="font-mono">{formatMoney(data.expenses?.totalExpenses || 0)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Net Profit / (Loss)</p>
                <p className="text-xs text-muted-foreground">Total Income minus Operating &amp; Financial Expenses</p>
              </div>
              <p className={cn('text-xl font-bold font-mono', (data.netProfit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600')}>
                {formatMoney(data.netProfit || 0)}
              </p>
            </div>
          </div>
        ) : type === 'balance-sheet' ? (
          <div className="space-y-4 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wide border-b pb-1">Assets</h4>
                <div className="flex justify-between text-xs py-1"><span>Cash in Hand (Vault):</span><span className="font-mono font-medium">{formatMoney(data.assets?.cashInHand || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Bank Accounts:</span><span className="font-mono font-medium">{formatMoney(data.assets?.bankAccounts || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Loan Receivables:</span><span className="font-mono font-medium">{formatMoney(data.assets?.loanReceivables || 0)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t text-primary"><span>Total Assets:</span><span className="font-mono">{formatMoney(data.assets?.totalAssets || 0)}</span></div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wide border-b pb-1">Liabilities &amp; Equity</h4>
                <div className="flex justify-between text-xs py-1"><span>Customer Compulsory Savings:</span><span className="font-mono font-medium">{formatMoney(data.liabilities?.customerSavings || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Invested Capital:</span><span className="font-mono font-medium">{formatMoney(data.equity?.investedCapital || 0)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Retained Earnings / Current Profit:</span><span className="font-mono font-medium">{formatMoney(data.equity?.retainedEarnings || 0)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t text-primary"><span>Total Liabilities &amp; Equity:</span><span className="font-mono">{formatMoney(data.totalLiabilitiesAndEquity || 0)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Balance Sheet Reconciliation:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {data.reconciled ? '✓ BALANCED (Total Assets = Liabilities + Equity)' : `Variance: ${formatMoney(data.variance || 0)}`}
              </span>
            </div>
          </div>
        ) : type === 'bank-reconciliation' ? (
          <div className="max-w-xl mx-auto space-y-3 p-2">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1"><span>1. Bank Balance as per Books:</span><span className="font-mono font-bold">{formatMoney(data.bookBalance || 0)}</span></div>
              <div className="flex justify-between py-1 text-muted-foreground"><span>2. Add: Deposits in Transit:</span><span className="font-mono">{formatMoney(data.depositsInTransit || 0)}</span></div>
              <div className="flex justify-between py-1 text-muted-foreground"><span>3. Less: Outstanding Cheques / Transfers:</span><span className="font-mono">{formatMoney(data.outstandingCheques || 0)}</span></div>
              <div className="flex justify-between py-1 text-muted-foreground"><span>4. Less: Bank Charges not entered:</span><span className="font-mono">{formatMoney(data.bankCharges || 0)}</span></div>
              <div className="flex justify-between py-2 border-t text-sm font-bold text-primary"><span>Reconciled Bank Balance:</span><span className="font-mono">{formatMoney(data.reconciledBalance || 0)}</span></div>
              <div className="flex justify-between py-1.5 border-t text-xs">
                <span>Reconciliation Difference:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {data.difference === 0 ? '₹0.00 (RECONCILED)' : formatMoney(data.difference)}
                </span>
              </div>
            </div>
          </div>
        ) : !data.items || data.items.length === 0 ? (
          <EmptyState message="No records found for the selected report / filters." icon={BarChart3} />
        ) : isGrouped && data.grouped ? (
          <div className="max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[650px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">{type === 'customer' ? 'Customer' : type === 'employee' ? 'Employee' : type === 'paymentmode' ? 'Mode' : type === 'accountstatus' ? 'Status' : 'Collector'}</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Count</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Total Amount</th>
                  {type === 'accountstatus' && <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Disbursed</th>}
                  {type === 'accountstatus' && <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Payable</th>}
                  {type === 'reconciliation' && <><th className="px-3 py-2 font-medium text-right whitespace-nowrap">Cash</th><th className="px-3 py-2 font-medium text-right whitespace-nowrap">UPI</th><th className="px-3 py-2 font-medium text-right whitespace-nowrap">Bank</th></>}
                </tr>
              </thead>
              <tbody>
                {data.grouped.map((g: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{g.key}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{g.count}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(g.total || g.payable || 0)}</td>
                    {type === 'accountstatus' && <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(g.disbursed || 0)}</td>}
                    {type === 'accountstatus' && <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(g.payable || 0)}</td>}
                    {type === 'reconciliation' && <><td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(g.cash || 0)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(g.upi || 0)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(g.bank || 0)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isBalance ? (
          <div className="max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[750px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Account</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Mobile</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Payable</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Outstanding</th>
                  {type === 'overdue' && <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Overdue</th>}
                  {type === 'overdue' && <th className="px-3 py-2 font-medium whitespace-nowrap">Days</th>}
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{it.accountNumber}</td>
                    <td className="px-3 py-2 font-medium max-w-[180px] truncate" title={it.customerName}>{it.customerName}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{it.mobile}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(it.totalPayable)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatMoney(it.paid)}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(it.outstanding)}</td>
                    {type === 'overdue' && <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatMoney(it.overdueAmount)}</td>}
                    {type === 'overdue' && <td className="px-3 py-2 text-center whitespace-nowrap">{it.overdueDays}</td>}
                    <td className="px-3 py-2 whitespace-nowrap"><Badge className={cn(STATUS_COLORS[it.status])}>{it.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[750px]">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Receipt</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Customer</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Account</th>
                  <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Amount</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Mode</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Collector</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{it.receiptNumber}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(it.collectionDate)}</td>
                    <td className="px-3 py-2 font-medium max-w-[180px] truncate" title={it.customerName}>{it.customerName}</td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{it.accountNumber}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(it.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><Badge variant="outline">{it.paymentMode}</Badge></td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{it.collectedBy}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><Badge className={cn(STATUS_COLORS[it.status])}>{it.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Print-only report layout */}
      {data && (
        <PrintReport
          title={`${report.label} Report`}
          subtitle={data.summary ? `${data.summary.count || 0} records` : undefined}
          dateFrom={data.summary?.dateFrom}
          dateTo={data.summary?.dateTo}
          summary={data.summary ? [
            { label: 'Total', value: formatMoney(data.summary.total || 0) },
            { label: 'Count', value: String(data.summary.count || 0) },
            { label: 'Cash', value: formatMoney(data.summary.cashTotal || 0) },
            { label: 'UPI', value: formatMoney(data.summary.upiTotal || 0) },
          ] : undefined}
          columns={printColumns}
          rows={data.grouped && isGrouped ? data.grouped : data.items}
        />
      )}
    </div>
  )
}
