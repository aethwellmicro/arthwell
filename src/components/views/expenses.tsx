'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ReceiptIndianRupee,
  Plus,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Wallet,
  Landmark,
  Building,
  Briefcase,
  Car,
  FileText,
  BadgeDollarSign,
  TrendingDown,
  Eye,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDate, formatDateTime, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SectionCard, LoadingRows, EmptyState } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ExpenseItem {
  id: string
  expenseNumber: string
  expenseType: string
  particulars: string
  amount: number
  paymentMode: string
  expenseDate: string
  recipientName?: string | null
  voucherNumber?: string | null
  remarks?: string | null
  status: string
  businessDate: string
  createdBy: { id: string; name: string }
}

const EXPENSE_TYPES: Record<string, { label: string; icon: any }> = {
  INVESTMENT_INTEREST: { label: 'Interest Paid on Investment', icon: BadgeDollarSign },
  OFFICE_EXPENSE: { label: 'Office Expenses', icon: Building },
  EMPLOYEE_SALARY: { label: 'Employee Salary', icon: Briefcase },
  TRAVELING: { label: 'Traveling Expenses', icon: Car },
  STATIONERY_ADMIN: { label: 'Stationery / Administrative Expenses', icon: FileText },
  UTILITIES: { label: 'Utilities (Electricity/Water/Net)', icon: Landmark },
  RENT: { label: 'Office Rent', icon: Building },
  OTHER: { label: 'Other Office Expenses', icon: TrendingDown },
}

export function ExpensesView() {
  const { user } = useApp()
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [bDateFilter, setBDateFilter] = useState('')

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    expenseType: 'OFFICE_EXPENSE',
    particulars: '',
    amount: '',
    paymentMode: 'CASH',
    expenseDate: new Date().toISOString().slice(0, 10),
    recipientName: '',
    voucherNumber: '',
    remarks: '',
  })

  // View Modal State
  const [viewTarget, setViewTarget] = useState<ExpenseItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (bDateFilter) params.set('businessDate', bDateFilter)
      if (q) params.set('q', q)
      const data = await apiFetch<{ items: ExpenseItem[]; summary: any }>(`/api/expenses?${params}`)
      setItems(data.items || [])
      setSummary(data.summary || null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, bDateFilter, q])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!createForm.particulars.trim()) {
      return toast.error('Particulars / description of the expense is required.')
    }
    const amt = parseFloat(createForm.amount)
    if (isNaN(amt) || amt <= 0) {
      return toast.error('Valid positive expense amount is required.')
    }

    setCreating(true)
    try {
      const res = await apiFetch<any>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(createForm),
      })
      toast.success(res.message || 'Expense recorded successfully!')
      setShowCreateModal(false)
      setCreateForm({
        expenseType: 'OFFICE_EXPENSE',
        particulars: '',
        amount: '',
        paymentMode: 'CASH',
        expenseDate: new Date().toISOString().slice(0, 10),
        recipientName: '',
        voucherNumber: '',
        remarks: '',
      })
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  function exportCSV() {
    if (!items.length) return toast.info('No expenses to export')
    downloadCSV(
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      items.map((e) => ({
        expenseNumber: e.expenseNumber,
        type: EXPENSE_TYPES[e.expenseType]?.label || e.expenseType,
        particulars: e.particulars,
        amount: e.amount,
        paymentMode: e.paymentMode,
        expenseDate: e.expenseDate,
        recipient: e.recipientName || '',
        voucher: e.voucherNumber || '',
        businessDate: e.businessDate,
        spentBy: e.createdBy.name,
        remarks: e.remarks || '',
      }))
    )
    toast.success('Expenses exported to CSV')
  }

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ReceiptIndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Expense Management</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Track operational, salary, traveling, office &amp; investor interest payouts. Automatically deducted (-) from Cash/Bank Balance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="flex-1 sm:flex-initial">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!items.length} className="flex-1 sm:flex-initial">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-initial gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-rose-600" /> Total Expenditure
          </p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(summary?.totalExpenseAmount || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {items.length} recorded vouchers &amp; disbursements
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <BadgeDollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Investment Interest Paid
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatMoney(summary?.byType?.INVESTMENT_INTEREST || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Interest paid to external investors</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-primary" /> Salaries &amp; Office Costs
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatMoney(
              (summary?.byType?.EMPLOYEE_SALARY || 0) +
              (summary?.byType?.OFFICE_EXPENSE || 0) +
              (summary?.byType?.RENT || 0)
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Staff salaries, rent and branch upkeep</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5 sm:gap-3 bg-card p-3 sm:p-4 rounded-xl border">
        <div className="col-span-2 sm:col-span-1 flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search particulars, EXP#, recipient, voucher..."
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        <div className="col-span-1">
          <Label className="text-xs text-muted-foreground">Expense Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="mt-1 w-full sm:w-[220px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-1">
          <Label className="text-xs text-muted-foreground">Business Date</Label>
          <Input
            type="date"
            value={bDateFilter}
            onChange={(e) => setBDateFilter(e.target.value)}
            className="mt-1 w-full sm:w-[140px] text-xs h-9"
          />
        </div>

        {(q || typeFilter !== 'ALL' || bDateFilter) && (
          <div className="col-span-1 sm:col-auto flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setTypeFilter('ALL')
                setBDateFilter('')
              }}
              className="h-9 text-xs"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Expense Table */}
      <SectionCard title={`Expenses Record (${items.length})`}>
        {loading ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ReceiptIndianRupee}
            message="No expense entries found matching your filters. Click 'Add Expense' to record your first outflow voucher."
          />
        ) : (
          <>
            {/* Mobile Card Layout (<md) */}
            <div className="md:hidden space-y-3 p-1">
              {items.map((e) => (
                <div key={e.id} className="rounded-lg border bg-card p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {e.expenseNumber}
                      </span>
                      <p className="font-bold text-sm text-foreground mt-0.5">{e.particulars}</p>
                      {e.recipientName && (
                        <p className="text-[11px] text-muted-foreground">Paid To: {e.recipientName}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {EXPENSE_TYPES[e.expenseType]?.label || e.expenseType}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Amount Deducted</span>
                      <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                        {formatMoney(e.amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Mode &amp; Date</span>
                      <span className="font-medium text-foreground">
                        {e.paymentMode} · {formatDate(e.expenseDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
                    <span>By {e.createdBy.name} · Voucher: {e.voucherNumber || '—'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setViewTarget(e)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>=md) */}
            <div className="hidden md:block max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-xs zebra-table min-w-[850px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Exp #</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Particulars</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Recipient / Party</th>
                    <th className="px-3 py-2 font-medium">Voucher #</th>
                    <th className="px-3 py-2 font-medium">Recorded By</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {e.expenseNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">
                          {EXPENSE_TYPES[e.expenseType]?.label || e.expenseType}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <p className="font-medium text-foreground truncate" title={e.particulars}>
                          {e.particulars}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(e.amount)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {e.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(e.expenseDate)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.recipientName || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {e.voucherNumber || '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.createdBy.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => setViewTarget(e)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {/* Add Expense Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ReceiptIndianRupee className="h-5 w-5 text-rose-600" /> Record New Expense Entry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1 text-xs">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200">
              <p className="font-semibold flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" /> Automatic Cash/Bank Deduction Effect
              </p>
              <p className="text-[11px] mt-0.5">
                Recording an expense will automatically debit (-) your vault cash balance (if Cash mode) or bank balance and reflect as an outflow in the Cash Book and Day End EOD Reconciliation.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Expense Category / Type *</Label>
              <Select
                value={createForm.expenseType}
                onValueChange={(v) => setCreateForm({ ...createForm, expenseType: v })}
              >
                <SelectTrigger className="mt-1 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Particulars / Description *</Label>
              <Input
                value={createForm.particulars}
                onChange={(e) => setCreateForm({ ...createForm, particulars: e.target.value })}
                placeholder="e.g. Month Office Electricity Bill, Tea/Refreshment for branch, or Salary payout"
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  placeholder="e.g. 2500"
                  className="mt-1 text-xs font-bold font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Payment Mode *</Label>
                <Select
                  value={createForm.paymentMode}
                  onValueChange={(v) => setCreateForm({ ...createForm, paymentMode: v })}
                >
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH (Vault Cash Deduction)</SelectItem>
                    <SelectItem value="BANK">BANK Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Date of Expenditure *</Label>
                <Input
                  type="date"
                  value={createForm.expenseDate}
                  onChange={(e) => setCreateForm({ ...createForm, expenseDate: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Recipient / Vendor / Employee</Label>
                <Input
                  value={createForm.recipientName}
                  onChange={(e) => setCreateForm({ ...createForm, recipientName: e.target.value })}
                  placeholder="e.g. Sunil Kumar (Field Officer) or Landlord"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Physical Voucher / Bill / Receipt #</Label>
              <Input
                value={createForm.voucherNumber}
                onChange={(e) => setCreateForm({ ...createForm, voucherNumber: e.target.value })}
                placeholder="e.g. VCH-2026-081 or EB-89712"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks</Label>
              <Textarea
                value={createForm.remarks}
                onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                placeholder="Optional notes or authorization details..."
                rows={2}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.particulars || !createForm.amount}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {creating ? 'Recording Outflow…' : 'Record Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Modal */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null) }}>
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ReceiptIndianRupee className="h-5 w-5 text-rose-600" /> Expense Voucher: {viewTarget?.expenseNumber}
            </DialogTitle>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground uppercase block">Particulars</span>
                  <span className="font-bold text-sm text-foreground">{viewTarget.particulars}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Amount</span>
                  <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                    {formatMoney(viewTarget.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Category</span>
                  <span className="font-medium text-foreground">
                    {EXPENSE_TYPES[viewTarget.expenseType]?.label || viewTarget.expenseType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Payment Mode</span>
                  <Badge variant="outline">{viewTarget.paymentMode}</Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Expense Date</span>
                  <span className="text-foreground">{formatDate(viewTarget.expenseDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Recipient / Party</span>
                  <span className="text-foreground">{viewTarget.recipientName || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Voucher / Bill #</span>
                  <span className="font-mono text-foreground">{viewTarget.voucherNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Recorded In Business Date</span>
                  <span className="font-mono text-foreground">{viewTarget.businessDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Authorized By</span>
                  <span className="text-foreground">{viewTarget.createdBy.name}</span>
                </div>
              </div>

              {viewTarget.remarks && (
                <div className="p-2.5 rounded bg-muted/20 border">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Remarks</span>
                  <p className="mt-0.5 text-foreground">{viewTarget.remarks}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
