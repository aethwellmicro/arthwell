'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  PiggyBank,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Clock,
  Landmark,
  BadgePercent,
  Banknote,
  DollarSign,
  User,
  Phone,
  Eye,
  Edit,
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
import { SectionCard, LoadingRows, EmptyState, StatCard } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface InvestmentItem {
  id: string
  investmentNumber: string
  investorName: string
  investorPhone?: string | null
  investmentType: string
  amount: number
  paymentMode: string
  investmentDate: string
  termMonths?: number | null
  interestRate?: number | null
  maturityDate?: string | null
  interestPaid: number
  status: string
  remarks?: string | null
  businessDate: string
  createdBy: { id: string; name: string }
}

const INVESTMENT_TYPES: Record<string, string> = {
  DIRECTOR_MEMBER: 'Director / Member Investment',
  INVESTOR_DEPOSIT: 'Investor Deposit',
  CAPITAL_INVESTMENT: 'Capital Investment',
  INSTITUTIONAL: 'Institutional Investment',
  OTHER: 'Other Investment',
}

export function InvestmentsView() {
  const { user } = useApp()
  const [items, setItems] = useState<InvestmentItem[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [bDateFilter, setBDateFilter] = useState('')

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    investorName: '',
    investorPhone: '',
    investmentType: 'INVESTOR_DEPOSIT',
    amount: '',
    paymentMode: 'CASH',
    investmentDate: new Date().toISOString().slice(0, 10),
    termMonths: '12',
    interestRate: '12',
    remarks: '',
  })

  // View / Edit Modal State
  const [viewTarget, setViewTarget] = useState<InvestmentItem | null>(null)
  const [editTarget, setEditTarget] = useState<InvestmentItem | null>(null)
  const [updating, setUpdating] = useState(false)
  const [interestToAdd, setInterestToAdd] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateRemarks, setUpdateRemarks] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (bDateFilter) params.set('businessDate', bDateFilter)
      if (q) params.set('q', q)
      const data = await apiFetch<{ items: InvestmentItem[]; summary: any }>(`/api/investments?${params}`)
      setItems(data.items || [])
      setSummary(data.summary || null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, bDateFilter, q])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!createForm.investorName.trim()) {
      return toast.error('Investor / Institution name is required.')
    }
    const amt = parseFloat(createForm.amount)
    if (isNaN(amt) || amt <= 0) {
      return toast.error('Valid positive investment amount is required.')
    }

    setCreating(true)
    try {
      const res = await apiFetch<any>('/api/investments', {
        method: 'POST',
        body: JSON.stringify(createForm),
      })
      toast.success(res.message || 'Investment recorded successfully!')
      setShowCreateModal(false)
      setCreateForm({
        investorName: '',
        investorPhone: '',
        investmentType: 'INVESTOR_DEPOSIT',
        amount: '',
        paymentMode: 'CASH',
        investmentDate: new Date().toISOString().slice(0, 10),
        termMonths: '12',
        interestRate: '12',
        remarks: '',
      })
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdate() {
    if (!editTarget) return
    setUpdating(true)
    try {
      const payload: any = {}
      if (updateStatus) payload.status = updateStatus
      if (updateRemarks) payload.remarks = updateRemarks
      if (interestToAdd && !isNaN(parseFloat(interestToAdd))) {
        payload.interestPaid = interestToAdd
      }

      const res = await apiFetch<any>(`/api/investments/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      toast.success(res.message || 'Investment updated successfully!')
      setEditTarget(null)
      setInterestToAdd('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUpdating(false)
    }
  }

  function exportCSV() {
    if (!items.length) return toast.info('No investments to export')
    downloadCSV(
      `investments-${new Date().toISOString().slice(0, 10)}.csv`,
      items.map((i) => ({
        investmentNumber: i.investmentNumber,
        investorName: i.investorName,
        phone: i.investorPhone || '',
        type: INVESTMENT_TYPES[i.investmentType] || i.investmentType,
        amount: i.amount,
        paymentMode: i.paymentMode,
        investmentDate: i.investmentDate,
        termMonths: i.termMonths || '',
        interestRate: i.interestRate ? `${i.interestRate}%` : '',
        maturityDate: i.maturityDate || '',
        interestPaid: i.interestPaid,
        status: i.status,
        businessDate: i.businessDate,
        createdBy: i.createdBy.name,
        remarks: i.remarks || '',
      }))
    )
    toast.success('Investments exported to CSV')
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PiggyBank className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Investment Management</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Capital, Director/Member deposits &amp; institutional funds. Inflows are automatically credited (+) to Cash/Bank Balance.
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
            <Plus className="h-4 w-4" /> Add Investment
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Active Investments
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {formatMoney(summary?.totalActiveAmount || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {items.filter((i) => i.status === 'ACTIVE').length} active portfolios
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <BadgePercent className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Interest Paid Out
          </p>
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
            {formatMoney(summary?.totalInterestPaid || 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Recorded cumulative interest payouts</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-2xs">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
            <Banknote className="h-4 w-4 text-primary" /> Total Portfolios
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {summary?.count || items.length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Director, member &amp; institutional records</p>
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
              placeholder="Search investor, INV#, phone..."
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        <div className="col-span-1">
          <Label className="text-xs text-muted-foreground">Investment Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="mt-1 w-full sm:w-[170px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {Object.entries(INVESTMENT_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="mt-1 w-full sm:w-[130px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="MATURED">Matured</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
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

        {(q || typeFilter !== 'ALL' || statusFilter !== 'ALL' || bDateFilter) && (
          <div className="col-span-1 sm:col-auto flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setTypeFilter('ALL')
                setStatusFilter('ALL')
                setBDateFilter('')
              }}
              className="h-9 text-xs"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Main List */}
      <SectionCard title={`Investments Record (${items.length})`}>
        {loading ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            message="No investment records found matching your filters. Click 'Add Investment' to record your first inflow."
          />
        ) : (
          <>
            {/* Mobile Card Layout (<md) */}
            <div className="md:hidden space-y-3 p-1">
              {items.map((i) => (
                <div key={i.id} className="rounded-lg border bg-card p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-semibold text-primary">{i.investmentNumber}</span>
                      <p className="font-bold text-sm text-foreground mt-0.5">{i.investorName}</p>
                      {i.investorPhone && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {i.investorPhone}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={cn(
                        'text-[10px]',
                        i.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : i.status === 'MATURED'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
                      )}
                    >
                      {i.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2.5 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Amount</span>
                      <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                        {formatMoney(i.amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Mode &amp; Date</span>
                      <span className="font-medium text-foreground">
                        {i.paymentMode} · {formatDate(i.investmentDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Type</span>
                      <span className="text-foreground truncate block">
                        {INVESTMENT_TYPES[i.investmentType] || i.investmentType}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Term / ROI</span>
                      <span className="font-medium text-foreground">
                        {i.termMonths ? `${i.termMonths}m` : '—'} @ {i.interestRate ? `${i.interestRate}%` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground">
                    <span>Maturity: {i.maturityDate ? formatDate(i.maturityDate) : 'Open'}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setViewTarget(i)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-primary"
                        onClick={() => {
                          setEditTarget(i)
                          setUpdateStatus(i.status)
                          setUpdateRemarks(i.remarks || '')
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" /> Manage
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>=md) */}
            <div className="hidden md:block max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-xs zebra-table min-w-[850px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Inv #</th>
                    <th className="px-3 py-2 font-medium">Investor</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-center">Term / ROI</th>
                    <th className="px-3 py-2 font-medium">Maturity</th>
                    <th className="px-3 py-2 font-medium text-right">Interest Paid</th>
                    <th className="px-3 py-2 font-medium text-center">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-semibold text-primary">{i.investmentNumber}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-foreground">{i.investorName}</p>
                        {i.investorPhone && (
                          <span className="text-[10px] text-muted-foreground font-mono">{i.investorPhone}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] text-foreground">
                          {INVESTMENT_TYPES[i.investmentType] || i.investmentType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(i.amount)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {i.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(i.investmentDate)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {i.termMonths ? `${i.termMonths} mo` : '—'}
                        {i.interestRate ? ` @ ${i.interestRate}%` : ''}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {i.maturityDate ? formatDate(i.maturityDate) : 'Open'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-teal-600 dark:text-teal-400">
                        {formatMoney(i.interestPaid)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          className={cn(
                            'text-[10px]',
                            i.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : i.status === 'MATURED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
                          )}
                        >
                          {i.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px]"
                            onClick={() => setViewTarget(i)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[11px] text-primary"
                            onClick={() => {
                              setEditTarget(i)
                              setUpdateStatus(i.status)
                              setUpdateRemarks(i.remarks || '')
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {/* Add Investment Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PiggyBank className="h-5 w-5 text-primary" /> Record New Investment Entry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200">
              <p className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Automatic Cash/Bank Credit Effect
              </p>
              <p className="text-[11px] mt-0.5">
                Recording an investment will automatically credit (+) your vault cash balance (if Cash mode) or bank account and establish an authoritative audit trail in the Cash Book.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Investor / Institution Name *</Label>
              <Input
                value={createForm.investorName}
                onChange={(e) => setCreateForm({ ...createForm, investorName: e.target.value })}
                placeholder="e.g. Ramesh Patel (Director) or Apex Ventures"
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Investor Mobile</Label>
                <Input
                  value={createForm.investorPhone}
                  onChange={(e) => setCreateForm({ ...createForm, investorPhone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Investment Type *</Label>
                <Select
                  value={createForm.investmentType}
                  onValueChange={(v) => setCreateForm({ ...createForm, investmentType: v })}
                >
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVESTMENT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Investment Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  placeholder="e.g. 500000"
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
                    <SelectItem value="CASH">CASH (Vault Cash Credit)</SelectItem>
                    <SelectItem value="BANK">BANK Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">Date *</Label>
                <Input
                  type="date"
                  value={createForm.investmentDate}
                  onChange={(e) => setCreateForm({ ...createForm, investmentDate: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Term (Months)</Label>
                <Input
                  type="number"
                  value={createForm.termMonths}
                  onChange={(e) => setCreateForm({ ...createForm, termMonths: e.target.value })}
                  placeholder="e.g. 12"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Interest Rate %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={createForm.interestRate}
                  onChange={(e) => setCreateForm({ ...createForm, interestRate: e.target.value })}
                  placeholder="e.g. 12"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks / Terms</Label>
              <Textarea
                value={createForm.remarks}
                onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                placeholder="Optional notes regarding ROI payouts, maturity conditions, or certificate numbers..."
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
              disabled={creating || !createForm.investorName || !createForm.amount}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {creating ? 'Recording Inflow…' : 'Record Investment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Investment Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null) }}>
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <PiggyBank className="h-5 w-5 text-primary" /> Investment Details: {viewTarget?.investmentNumber}
            </DialogTitle>
          </DialogHeader>

          {viewTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Investor Name</span>
                  <span className="font-bold text-sm text-foreground">{viewTarget.investorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Amount</span>
                  <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                    {formatMoney(viewTarget.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Investment Type</span>
                  <span className="font-medium text-foreground">
                    {INVESTMENT_TYPES[viewTarget.investmentType] || viewTarget.investmentType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Payment Mode</span>
                  <Badge variant="outline">{viewTarget.paymentMode}</Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Date Received</span>
                  <span className="text-foreground">{formatDate(viewTarget.investmentDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Active Business Date</span>
                  <span className="font-mono text-foreground">{viewTarget.businessDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Term &amp; Interest</span>
                  <span className="text-foreground font-semibold">
                    {viewTarget.termMonths ? `${viewTarget.termMonths} Months` : 'Open Term'} @ {viewTarget.interestRate ? `${viewTarget.interestRate}%` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Maturity Date</span>
                  <span className="text-foreground">
                    {viewTarget.maturityDate ? formatDate(viewTarget.maturityDate) : 'Not Specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Interest Paid to Date</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {formatMoney(viewTarget.interestPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Recorded By</span>
                  <span className="text-foreground">{viewTarget.createdBy?.name || 'System'}</span>
                </div>
              </div>

              {viewTarget.remarks && (
                <div className="p-2.5 rounded bg-muted/20 border">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Remarks / Terms</span>
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

      {/* Edit / Manage Investment Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Edit className="h-5 w-5 text-primary" /> Manage Investment: {editTarget?.investmentNumber}
            </DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-muted/40 p-2.5 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{editTarget.investorName}</p>
                  <p className="text-[11px] text-muted-foreground">Principal: {formatMoney(editTarget.amount)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Interest Paid</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">{formatMoney(editTarget.interestPaid)}</span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Record Additional Interest Paid (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={interestToAdd}
                  onChange={(e) => setInterestToAdd(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Enter new interest payout made to investor. This adds to cumulative interest paid.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Portfolio Status</Label>
                <Select value={updateStatus} onValueChange={setUpdateStatus}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="MATURED">MATURED</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Update Remarks</Label>
                <Textarea
                  value={updateRemarks}
                  onChange={(e) => setUpdateRemarks(e.target.value)}
                  placeholder="Notes on return payout, maturity closure, or renewals..."
                  rows={2}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating} className="bg-primary text-primary-foreground font-semibold">
              {updating ? 'Saving Changes…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
