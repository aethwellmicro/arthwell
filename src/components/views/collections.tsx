'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import {
  HandCoins,
  Search,
  Plus,
  Printer,
  Undo2,
  Eye,
  Receipt as ReceiptIcon,
  X,
  FileSpreadsheet,
  CalendarClock,
  UsersRound,
  CheckCircle2,
  Check,
  XCircle,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, todayInput, STATUS_COLORS, downloadCSV } from '@/lib/format'
import { useApp, canReverse } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
import { SortableHeader, sortArray } from '@/components/sortable-header'
import { ReceiptPrint } from '@/components/receipt-print'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Collection {
  id: string
  receiptNumber: string
  collectionDate: string
  customer: { customerId: string; fullName: string; primaryMobile: string; area?: string | null }
  account: { accountNumber: string }
  amount: number
  allocatedPrincipal?: number
  allocatedInterest?: number
  allocatedSavings?: number
  otherCharges?: number
  paymentMode: string
  collectedBy: { name: string; employeeCode?: string | null; role: string }
  previousOutstanding: number
  currentOutstanding: number
  status: string
  approvedAt?: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  remarks?: string | null
}

interface CustomerOption {
  id: string
  customerId: string
  fullName: string
  primaryMobile: string
}
interface AccountOption {
  id: string
  accountNumber: string
  outstanding: number
  totalPayable: number
  paidAmount: number
  installmentAmount: number
  savingsAmount?: number
  status: string
}

const emptyForm = {
  customerId: '',
  accountId: '',
  emiAmount: '',
  savingsAmount: '',
  amount: '',
  paymentMode: 'CASH',
  collectionDate: todayInput(),
  remarks: '',
}

import { useRouter, useSearchParams } from 'next/navigation'

export function CollectionsView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const customerIdParam = searchParams.get('customer')
  const accountIdParam = searchParams.get('account')
  const { user } = useApp()
  const [items, setItems] = useState<Collection[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [paymentMode, setPaymentMode] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [employees, setEmployees] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [reverseTarget, setReverseTarget] = useState<Collection | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [viewTarget, setViewTarget] = useState<Collection | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Approval Workflow State
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'due'>('pending')
  const [rejectTarget, setRejectTarget] = useState<Collection | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const [dueDateFilter, setDueDateFilter] = useState(new Date().toISOString().slice(0, 10))
  const [dueEmployeeId, setDueEmployeeId] = useState('ALL')
  const [dueData, setDueData] = useState<{
    date: string
    grandTotals: { totalCustomers: number; totalDue: number; totalCollected: number; totalPending: number }
    officers: any[]
  } | null>(null)
  const [loadingDue, setLoadingDue] = useState(false)

  const loadDue = async (targetDate?: string, targetEmp?: string) => {
    setLoadingDue(true)
    try {
      const d = targetDate || dueDateFilter
      const emp = targetEmp !== undefined ? targetEmp : dueEmployeeId
      const params = new URLSearchParams({ date: d })
      if (emp && emp !== 'ALL') params.set('employeeId', emp)
      const res = await apiFetch<any>(`/api/collections/due?${params}`)
      setDueData(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingDue(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'due') {
      loadDue()
    }
  }, [activeTab, dueDateFilter, dueEmployeeId])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (employeeId) params.set('employeeId', employeeId)
      if (paymentMode !== 'ALL') params.set('paymentMode', paymentMode)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const data = await apiFetch<{ items: Collection[] }>(`/api/collections?${params}`)
      setItems(data.items)
      setPage(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    apiFetch<{ items: any[] }>('/api/employees').then((d) => setEmployees(d.items)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [from, to, employeeId, paymentMode, statusFilter])

  // open new collection dialog if URL params are set
  useEffect(() => {
    if (customerIdParam && accountIdParam) {
      setForm({ ...emptyForm, customerId: customerIdParam, accountId: accountIdParam })
      setShowNew(true)
    }
  }, [customerIdParam, accountIdParam])

  async function save() {
    const emiVal = parseFloat(form.emiAmount) || 0
    const savVal = parseFloat(form.savingsAmount) || 0
    const totAmt = parseFloat(form.amount) || (emiVal + savVal)

    if (!form.customerId || !form.accountId || totAmt <= 0) {
      toast.error('Customer, account and amount (EMI/Savings) are required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        amount: String(totAmt),
      }
      const created = await apiFetch<any>('/api/collections', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toast.success(`Collection recorded: ${created.receiptNumber}`)
      setShowNew(false)
      setForm(emptyForm)
      // fetch full receipt data
      const full = await apiFetch<any>(`/api/collections/${created.id}`)
      setReceipt(full)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function doReverse() {
    if (!reverseTarget || !reverseReason.trim()) return toast.error('Reason is required.')
    try {
      await apiFetch(`/api/collections/${reverseTarget.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reverseReason }),
      })
      toast.success('Transaction reversed')
      setReverseTarget(null)
      setReverseReason('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleApprove(c: Collection) {
    setApprovingId(c.id)
    try {
      await apiFetch(`/api/collections/${c.id}/approve`, { method: 'POST' })
      toast.success(`Collection ${c.receiptNumber} approved successfully.`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setApprovingId(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) {
      return toast.error('A mandatory rejection reason is required.')
    }
    setRejecting(true)
    try {
      await apiFetch(`/api/collections/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      toast.success(`Collection ${rejectTarget.receiptNumber} rejected.`)
      setRejectTarget(null)
      setRejectReason('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRejecting(false)
    }
  }

  function openReceiptPrint(c: Collection | any) {
    window.open(`/receipts/${c.id}/print`, '_blank')
  }

  async function printReceipt(c: Collection) {
    try {
      await apiFetch(`/api/collections/${c.id}/receipt`, { method: 'POST' })
    } catch {}
    openReceiptPrint(c)
  }

  function exportCSV() {
    if (!items.length) return toast.info('No collections to export')
    downloadCSV(`collections-${new Date().toISOString().slice(0, 10)}.csv`, items.map((c) => {
      const emiMatch = c.remarks?.match(/EMI:\s*₹?([\d.]+)/)
      const savMatch = c.remarks?.match(/Savings:\s*₹?([\d.]+)/)
      const emi = emiMatch ? parseFloat(emiMatch[1]) : c.amount
      const savings = savMatch ? parseFloat(savMatch[1]) : 0
      return {
        receiptNumber: c.receiptNumber,
        date: formatDateTime(c.collectionDate),
        customer: c.customer.fullName,
        customerId: c.customer.customerId,
        mobile: c.customer.primaryMobile,
        account: c.account.accountNumber,
        totalAmount: c.amount,
        emiAmount: emi,
        savingsAmount: savings,
        paymentMode: c.paymentMode,
        collectedBy: c.collectedBy.name,
        previousOutstanding: c.previousOutstanding,
        currentOutstanding: c.currentOutstanding,
        status: c.status,
        remarks: c.remarks || '',
      }
    }))
    toast.success('Exported to CSV')
  }

  const total = items.reduce((s, c) => s + (c.status === 'SUCCESSFUL' ? c.amount : 0), 0)



  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedItems = useMemo(() => {
    if (sortKey && sortDir) return sortArray(items, sortKey, sortDir)
    return items
  }, [items, sortKey, sortDir])

  const pendingCount = useMemo(() => items.filter((c) => c.status === 'PENDING_APPROVAL').length, [items])

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history' | 'due')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="grid grid-cols-3 w-full sm:w-[500px]">
            <TabsTrigger value="pending" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4" /> Pending Approvals
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-bold">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <ReceiptIcon className="h-4 w-4" /> History
            </TabsTrigger>
            <TabsTrigger value="due" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
              <CalendarClock className="h-4 w-4" /> Due by Date
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => { setForm(emptyForm); setShowNew(true) }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" /> New Collection
          </Button>
        </div>

        {/* Tab 1: Pending Verification & Approval */}
        <TabsContent value="pending" className="space-y-4 pt-2">
          {(() => {
            const pendingList = items.filter((c) => c.status === 'PENDING_APPROVAL')
            const totalPendingAmt = pendingList.reduce((s, c) => s + c.amount, 0)
            const canApprove = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'ACCOUNTANT'

            return (
              <SectionCard
                title={`Pending Collection Approvals (${pendingList.length})`}
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total Pending:</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatMoney(totalPendingAmt)}</span>
                  </div>
                }
              >
                {loading ? (
                  <LoadingRows rows={4} />
                ) : pendingList.length === 0 ? (
                  <EmptyState icon={ShieldCheck} message="No collections currently pending approval. All collections have been verified." />
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3 p-1">
                      {pendingList.map((c) => (
                        <div key={c.id} className="rounded-lg border bg-card p-3 space-y-2.5 text-xs shadow-2xs">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{c.customer.fullName}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{c.customer.customerId} · {c.customer.primaryMobile}</p>
                            </div>
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                              PENDING APPROVAL
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2 rounded text-[11px]">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Receipt No</span>
                              <span className="font-mono font-medium">{c.receiptNumber}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground block text-[10px]">Total Amount</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatMoney(c.amount)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Loan Account</span>
                              <span className="font-mono">{c.account.accountNumber}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground block text-[10px]">Collected By</span>
                              <span>{c.collectedBy.name}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                            <span>Date: {formatDateTime(c.collectionDate)}</span>
                            <span>Mode: <strong>{c.paymentMode}</strong></span>
                          </div>

                          {canApprove && (
                            <div className="flex items-center gap-2 pt-1 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => {
                                  setRejectTarget(c)
                                  setRejectReason('')
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={approvingId === c.id}
                                onClick={() => handleApprove(c)}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                {approvingId === c.id ? 'Approving...' : 'Approve'}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm zebra-table min-w-[850px]">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Receipt</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date / Time</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Account</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Mode</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Field Officer</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingList.map((c) => (
                            <tr key={c.id} className="border-b hover:bg-muted/40 cursor-pointer" onClick={() => setViewTarget(c)}>
                              <td className="px-3 py-2.5 font-mono text-xs">{c.receiptNumber}</td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(c.collectionDate)}</td>
                              <td className="px-3 py-2.5">
                                <p className="font-semibold text-foreground">{c.customer.fullName}</p>
                                <p className="font-mono text-xs text-muted-foreground">{c.customer.customerId}</p>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">{c.account.accountNumber}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {formatMoney(c.amount)}
                              </td>
                              <td className="px-3 py-2.5"><Badge variant="outline">{c.paymentMode}</Badge></td>
                              <td className="px-3 py-2.5 text-xs">{c.collectedBy.name}</td>
                              <td className="px-3 py-2.5">
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                                  PENDING APPROVAL
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                {canApprove ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      onClick={() => {
                                        setRejectTarget(c)
                                        setRejectReason('')
                                      }}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                      disabled={approvingId === c.id}
                                      onClick={() => handleApprove(c)}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      {approvingId === c.id ? 'Approving...' : 'Approve'}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Awaiting Back Office</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </SectionCard>
            )
          })()}
        </TabsContent>

        <TabsContent value="due" className="space-y-4 pt-2">
          {/* Date Selector & Officer Filters */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-card p-3 sm:p-4 rounded-xl border">
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-end gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-auto">
                <Label className="text-xs font-semibold text-foreground">Select Due Date *</Label>
                <Input
                  type="date"
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="w-full sm:w-[170px] font-mono text-sm"
                />
              </div>
              <div className="w-full sm:w-auto">
                <Label className="text-xs font-semibold text-foreground">Employee / Officer</Label>
                <Select value={dueEmployeeId} onValueChange={setDueEmployeeId}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Officers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Officers</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({e.employeeCode || 'FO'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                <Button variant="outline" size="sm" onClick={() => loadDue()} disabled={loadingDue} className="flex-1 sm:flex-initial">
                  <CalendarClock className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
                {dueData && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      onClick={() => {
                        const allCustomers = dueData.officers.flatMap((off) =>
                          off.customers.map((c: any) => ({
                            officerName: off.officerName,
                            officerCode: off.officerCode,
                            customerName: c.customerName,
                            customerId: c.customerRefId,
                            mobile: c.mobile,
                            group: `${c.groupId} (${c.groupName})`,
                            accountNumber: c.accountNumber,
                            weekNumber: c.installNo,
                            dueDate: c.dueDate,
                            emi: c.emi,
                            savings: c.savings,
                            totalDue: c.totalDue,
                            paid: c.paid,
                            pending: c.pending,
                            status: c.status,
                          }))
                        )
                        downloadCSV(`collections-due-${dueDateFilter}.csv`, allCustomers)
                        toast.success(`Exported ${allCustomers.length} due collections to CSV`)
                      }}
                      disabled={!dueData.officers.length}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial no-print"
                      onClick={() => window.print()}
                      disabled={!dueData.officers.length}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </>
                )}
              </div>
            </div>

            {dueData && (
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-3 p-2 bg-muted/40 rounded-lg border text-xs w-full sm:w-auto justify-between sm:justify-end">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Due</span>
                  <span className="text-sm sm:text-base font-bold text-primary">{formatMoney(dueData.grandTotals.totalDue)}</span>
                </div>
                <div className="text-center sm:text-right border-x sm:border-x-0 px-2 sm:px-0">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Collected</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(dueData.grandTotals.totalCollected)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Pending</span>
                  <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">{formatMoney(dueData.grandTotals.totalPending)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Grouped by Field Officer */}
          {loadingDue ? (
            <LoadingRows rows={4} />
          ) : !dueData || dueData.officers.length === 0 ? (
            <EmptyState message={`No installments due on ${dueDateFilter}.`} icon={CalendarClock} />
          ) : (
            <div className="space-y-5 print-report">
              {dueData.officers.map((off: any) => (
                <SectionCard
                  key={off.officerId}
                  title={`Field Officer: ${off.officerName} (${off.officerCode})`}
                  action={
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                      <span>Customers: <strong>{off.totalCustomers}</strong></span>
                      <span>Total Due: <strong className="text-primary">{formatMoney(off.totalDue)}</strong></span>
                      <span>Collected: <strong className="text-emerald-600 dark:text-emerald-400">{formatMoney(off.totalCollected)}</strong></span>
                      <span>Pending: <strong className="text-amber-600 dark:text-amber-400">{formatMoney(off.totalPending)}</strong></span>
                    </div>
                  }
                >
                  {/* Mobile card layout */}
                  <div className="md:hidden space-y-3 p-1">
                    {off.customers.map((c: any) => (
                      <div key={c.installmentId} className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground text-sm">{c.customerName}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{c.customerRefId} · {c.mobile}</p>
                          </div>
                          <Badge className={cn('text-[10px]', STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-800')}>
                            {c.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[11px] border-y py-1.5">
                          <span>Group: <strong className="text-foreground">{c.groupId}</strong> ({c.groupName})</span>
                          <span className="font-mono">{c.accountNumber} (W#{c.installNo})</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-muted/40 p-1.5 rounded">
                            <span className="text-[10px] text-muted-foreground block">Total Due</span>
                            <span className="font-bold text-primary">{formatMoney(c.totalDue)}</span>
                          </div>
                          <div className="bg-muted/40 p-1.5 rounded">
                            <span className="text-[10px] text-muted-foreground block">Paid</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(c.paid)}</span>
                          </div>
                          <div className="bg-muted/40 p-1.5 rounded">
                            <span className="text-[10px] text-muted-foreground block">Pending</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{formatMoney(c.pending)}</span>
                          </div>
                        </div>
                        {c.pending > 0 && (
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs font-medium mt-1"
                            onClick={() => {
                              const emiPortion = Math.min(c.emi || 0, c.pending)
                              const savPortion = Math.max(c.pending - emiPortion, 0) || (c.savings || 0)
                              setForm({
                                ...emptyForm,
                                customerId: c.customerId,
                                accountId: c.accountId,
                                emiAmount: String(emiPortion),
                                savingsAmount: String(savPortion),
                                amount: String(c.pending),
                              })
                              setShowNew(true)
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Collect {formatMoney(c.pending)}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs zebra-table min-w-[760px]">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Customer</th>
                          <th className="px-3 py-2 font-medium">Mobile</th>
                          <th className="px-3 py-2 font-medium">Group</th>
                          <th className="px-3 py-2 font-medium">Account</th>
                          <th className="px-3 py-2 font-medium text-right">EMI</th>
                          <th className="px-3 py-2 font-medium text-right">Savings</th>
                          <th className="px-3 py-2 font-medium text-right">Total Due</th>
                          <th className="px-3 py-2 font-medium text-right">Paid</th>
                          <th className="px-3 py-2 font-medium text-right">Pending</th>
                          <th className="px-3 py-2 font-medium text-center">Status</th>
                          <th className="px-3 py-2 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {off.customers.map((c: any) => (
                          <tr key={c.installmentId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <p className="font-semibold text-foreground">{c.customerName}</p>
                              <span className="font-mono text-[10px] text-muted-foreground">{c.customerRefId}</span>
                            </td>
                            <td className="px-3 py-2 font-mono">{c.mobile}</td>
                            <td className="px-3 py-2">
                              <span className="font-mono text-primary font-medium">{c.groupId}</span>
                              <span className="text-muted-foreground block text-[10px]">{c.groupName}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{c.accountNumber} (W#{c.installNo})</td>
                            <td className="px-3 py-2 text-right">{formatMoney(c.emi)}</td>
                            <td className="px-3 py-2 text-right text-teal-600 dark:text-teal-400 font-medium">{formatMoney(c.savings)}</td>
                            <td className="px-3 py-2 text-right font-bold text-primary">{formatMoney(c.totalDue)}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(c.paid)}</td>
                            <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400 font-bold">{formatMoney(c.pending)}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge className={cn('text-[10px]', STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-800')}>{c.status}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {c.pending > 0 && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2.5"
                                  onClick={() => {
                                    const emiPortion = Math.min(c.emi || 0, c.pending)
                                    const savPortion = Math.max(c.pending - emiPortion, 0) || (c.savings || 0)
                                    setForm({
                                      ...emptyForm,
                                      customerId: c.customerId,
                                      accountId: c.accountId,
                                      emiAmount: String(emiPortion),
                                      savingsAmount: String(savPortion),
                                      amount: String(c.pending),
                                    })
                                    setShowNew(true)
                                  }}
                                >
                                  Collect
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5 sm:gap-3">
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-[140px]" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-[140px]" />
            </div>
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
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">Mode</Label>
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
            <div className="col-span-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="SUCCESSFUL">Successful</SelectItem>
                  <SelectItem value="REVERSED">Reversed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:ml-auto flex items-center gap-2 justify-end pt-1 sm:pt-0">
              {(from || to || employeeId || paymentMode !== 'ALL' || statusFilter !== 'ALL') && (
                <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setEmployeeId(''); setPaymentMode('ALL'); setStatusFilter('SUCCESSFUL') }} className="flex-1 sm:flex-initial">
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!items.length} className="flex-1 sm:flex-initial">
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          </div>

      <SectionCard title={`Collections (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No collections found for the selected filters." icon={HandCoins} />
        ) : (
          <>
          {/* Mobile Card Layout (<md) */}
          <div className="md:hidden space-y-3 p-1">
            {paginatedItems.map((c) => (
              <div
                key={c.id}
                onClick={() => setViewTarget(c)}
                className="rounded-lg border bg-card p-3.5 space-y-2.5 shadow-xs cursor-pointer active:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">{c.customer.fullName}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{c.customer.customerId} · {c.customer.primaryMobile}</p>
                  </div>
                  <Badge className={cn('text-[10px]', STATUS_COLORS[c.status])}>{c.status}</Badge>
                </div>

                <div className="flex items-center justify-between text-xs border-y py-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Receipt</span>
                    <span className="font-mono font-medium text-foreground">{c.receiptNumber}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Total Amount</span>
                    <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">{formatMoney(c.amount)}</span>
                    {(() => {
                      const emiMatch = c.remarks?.match(/EMI:\s*₹?([\d.]+)/)
                      const savMatch = c.remarks?.match(/Savings:\s*₹?([\d.]+)/)
                      if (emiMatch || savMatch) {
                        return (
                          <div className="text-[10px] text-muted-foreground flex gap-1 justify-end font-medium">
                            {emiMatch && <span>EMI: {formatMoney(parseFloat(emiMatch[1]))}</span>}
                            {savMatch && <span className="text-teal-600 dark:text-teal-400">· Sav: {formatMoney(parseFloat(savMatch[1]))}</span>}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px] text-muted-foreground">
                  <div>
                    <span className="block text-[10px]">Account</span>
                    <span className="font-mono font-medium text-foreground">{c.account.accountNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">Mode</span>
                    <span className="font-medium text-foreground">{c.paymentMode}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px]">Balance</span>
                    <span className="font-semibold text-foreground">{formatMoney(c.currentOutstanding)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t text-[11px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <span>By {c.collectedBy.name}</span>
                  <div className="flex items-center gap-1">
                    {c.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'ACCOUNTANT') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => {
                            setRejectTarget(c)
                            setRejectReason('')
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={approvingId === c.id}
                          onClick={() => handleApprove(c)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => printReceipt(c)}>
                      <Printer className="h-3.5 w-3.5 mr-1" /> Receipt
                    </Button>
                    {canReverse(user?.role) && (c.status === 'SUCCESSFUL' || c.status === 'APPROVED') && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-600" onClick={() => setReverseTarget(c)}>
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>=md) */}
          <div className="hidden md:block max-h-[55vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[850px]">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Receipt" sortKey="receiptNumber" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Date" sortKey="collectionDate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Customer" sortKey="customer.fullName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Account" sortKey="account.accountNumber" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Amount" sortKey="amount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Mode" sortKey="paymentMode" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Collected By" sortKey="collectedBy.name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Outstanding" sortKey="currentOutstanding" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 font-medium text-right text-xs text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => setViewTarget(c)}>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.receiptNumber}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateTime(c.collectionDate)}</td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <p className="font-medium truncate" title={c.customer.fullName}>{c.customer.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.customer.customerId}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.account.accountNumber}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(c.amount)}</p>
                      {(() => {
                        const emiMatch = c.remarks?.match(/EMI:\s*₹?([\d.]+)/)
                        const savMatch = c.remarks?.match(/Savings:\s*₹?([\d.]+)/)
                        if (emiMatch || savMatch) {
                          return (
                            <p className="text-[10px] text-muted-foreground font-normal">
                              {emiMatch && `EMI: ${formatMoney(parseFloat(emiMatch[1]))}`}
                              {savMatch && ` · Sav: ${formatMoney(parseFloat(savMatch[1]))}`}
                            </p>
                          )
                        }
                        return null
                      })()}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><Badge variant="outline">{c.paymentMode}</Badge></td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{c.collectedBy.name}</td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatMoney(c.currentOutstanding)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><Badge className={cn(STATUS_COLORS[c.status])}>{c.status}</Badge></td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 items-center">
                        {c.status === 'PENDING_APPROVAL' && (user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'ACCOUNTANT') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => {
                                setRejectTarget(c)
                                setRejectReason('')
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={approvingId === c.id}
                              onClick={() => handleApprove(c)}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              {approvingId === c.id ? 'Approving...' : 'Approve'}
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printReceipt(c)} aria-label="Print receipt"><Printer className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewTarget(c)} aria-label="View details"><Eye className="h-3.5 w-3.5" /></Button>
                        {canReverse(user?.role) && (c.status === 'SUCCESSFUL' || c.status === 'APPROVED') && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => setReverseTarget(c)} aria-label="Reverse transaction"><Undo2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 sticky bottom-0">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right font-medium">Total Successful:</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(total)}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {items.length > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={items.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          )}
          </>
        )}
      </SectionCard>
      </TabsContent>
      </Tabs>

      {/* New collection dialog */}
      <Dialog open={showNew} onOpenChange={(o) => { 
        setShowNew(o)
        if (!o && (customerIdParam || accountIdParam)) {
          router.replace('/collections')
        }
      }}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> New Collection</DialogTitle>
          </DialogHeader>
          <NewCollectionForm form={form} setForm={setForm} />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNew(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? 'Saving…' : 'Record Collection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null) }}>
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><ReceiptIcon className="h-5 w-5 text-primary" /> Collection Receipt</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-2 overflow-x-hidden">
                <ReceiptPrint ref={receiptRef} data={{
                  receiptNumber: receipt.receiptNumber,
                  branchName: receipt.receipt?.branchName,
                  customerName: receipt.customer?.fullName,
                  customerId: receipt.customer?.customerId,
                  mobile: receipt.customer?.primaryMobile,
                  accountNumber: receipt.account?.accountNumber,
                  collectionDate: receipt.collectionDate,
                  amount: Number(receipt.amount),
                  paymentMode: receipt.paymentMode,
                  collectedBy: receipt.collectedBy?.name,
                  previousOutstanding: Number(receipt.previousOutstanding),
                  currentOutstanding: Number(receipt.currentOutstanding),
                  remarks: receipt.remarks,
                }} />
              </div>
              <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2 pt-2 border-t no-print">
                <Button variant="outline" size="sm" onClick={() => setReceipt(null)} className="flex-1 sm:flex-initial">Close</Button>
                <Button size="sm" onClick={() => openReceiptPrint(receipt)} className="flex-1 sm:flex-initial gap-1.5 bg-primary text-primary-foreground"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reverse dialog */}
      <Dialog open={!!reverseTarget} onOpenChange={(o) => { if (!o) { setReverseTarget(null); setReverseReason('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Undo2 className="h-5 w-5 text-amber-600" /> Reverse Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">You are about to reverse receipt <span className="font-mono font-semibold">{reverseTarget?.receiptNumber}</span> for {formatMoney(reverseTarget?.amount || 0)}. This will restore the outstanding balance and de-allocate installments. The transaction is not deleted — it is marked as reversed for audit.</p>
            <div>
              <Label>Reason for reversal *</Label>
              <Textarea value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="e.g. Wrong amount entered, customer cancelled payment…" className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReverseTarget(null); setReverseReason('') }}>Cancel</Button>
            <Button variant="destructive" onClick={doReverse}><Undo2 className="h-4 w-4 mr-1" /> Reverse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptIcon className="h-5 w-5 text-primary" /> {viewTarget?.receiptNumber}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="grid grid-cols-2 gap-3 py-2 text-sm">
              <Info label="Date / Time" value={formatDateTime(viewTarget.collectionDate)} />
              <Info label="Status" value={viewTarget.status} />
              <Info label="Customer" value={`${viewTarget.customer.fullName} (${viewTarget.customer.customerId})`} />
              <Info label="Mobile" value={viewTarget.customer.primaryMobile} />
              <Info label="Account" value={viewTarget.account.accountNumber} />
              <Info label="Payment Mode" value={viewTarget.paymentMode} />
              <Info label="Collected By" value={`${viewTarget.collectedBy.name}`} />
              <Info label="Total Collected" value={formatMoney(viewTarget.amount)} />
              {(() => {
                const emiMatch = viewTarget.remarks?.match(/EMI:\s*₹?([\d.]+)/)
                const savMatch = viewTarget.remarks?.match(/Savings:\s*₹?([\d.]+)/)
                if (emiMatch || savMatch) {
                  return (
                    <>
                      <Info label="EMI Portion" value={emiMatch ? formatMoney(parseFloat(emiMatch[1])) : formatMoney(viewTarget.amount)} />
                      <Info label="Savings Portion" value={savMatch ? formatMoney(parseFloat(savMatch[1])) : '₹0.00'} />
                    </>
                  )
                }
                return null
              })()}
              <Info label="Prev. Outstanding" value={formatMoney(viewTarget.previousOutstanding)} />
              <Info label="Curr. Outstanding" value={formatMoney(viewTarget.currentOutstanding)} />
              {viewTarget.remarks && <Info label="Remarks" value={viewTarget.remarks} />}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button onClick={() => viewTarget && printReceipt(viewTarget)}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Collection Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600"><XCircle className="h-5 w-5" /> Reject Collection Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>You are rejecting collection <span className="font-mono font-semibold">{rejectTarget?.receiptNumber}</span> of {formatMoney(rejectTarget?.amount || 0)} for <span className="font-semibold">{rejectTarget?.customer.fullName}</span>.</p>
            <p className="text-xs text-muted-foreground">Rejected collections do not affect the Cash Book, closing cash, or loan installments. A mandatory reason is required for audit and Field Officer notification.</p>
            <div>
              <Label className="text-xs font-semibold">Mandatory Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Physical cash not received, customer disputed amount, incorrect account..."
                className="mt-1 text-xs"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting || !rejectReason.trim()}>
              {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewCollectionForm({ form, setForm }: { form: typeof emptyForm; setForm: (f: typeof emptyForm) => void }) {
  const [cq, setCq] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams()
      if (cq) params.set('q', cq)
      params.set('limit', '15')
      const data = await apiFetch<{ items: CustomerOption[] }>(`/api/customers?${params}`)
      setCustomers(data.items)
    }, 250)
    return () => clearTimeout(t)
  }, [cq])

  useEffect(() => {
    if (!form.customerId) { setAccounts([]); return }
    apiFetch<{ items: AccountOption[] }>(`/api/customers/${form.customerId}/accounts`).then((d) => {
      setAccounts(d.items)
    }).catch(() => setAccounts([]))
  }, [form.customerId])

  const selectedAccount = accounts.find((a) => a.id === form.accountId)
  const amount = parseFloat(form.amount) || 0

  return (
    <div className="space-y-4 py-2">
      {/* Step 1: customer */}
      <div>
        <Label className="text-xs text-muted-foreground">Step 1 · Find Customer</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search by name, mobile, or customer ID…" className="pl-8" />
        </div>
        <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v, accountId: '' })}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.primaryMobile} ({c.customerId})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: account */}
      {form.customerId && (
        <div>
          <Label className="text-xs text-muted-foreground">Step 2 · Select Account</Label>
          <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} disabled={a.status === 'COMPLETED' || a.status === 'CLOSED'}>
                  {a.accountNumber} · Outstanding {formatMoney(a.outstanding)} ({a.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accounts.length === 0 && <p className="text-xs text-muted-foreground mt-1">No accounts for this customer.</p>}
        </div>
      )}

      {/* Step 3: summary */}
      {selectedAccount && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Step 3 · Account Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><p className="text-[10px] text-muted-foreground">Total Payable</p><p className="font-semibold">{formatMoney(selectedAccount.totalPayable)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Paid</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(selectedAccount.paidAmount)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Outstanding</p><p className="font-semibold text-amber-600 dark:text-amber-400">{formatMoney(selectedAccount.outstanding)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Regular EMI</p><p className="font-semibold">{formatMoney(selectedAccount.installmentAmount)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Savings / Week</p><p className="font-semibold text-teal-600 dark:text-teal-400">{formatMoney(selectedAccount.savingsAmount || 0)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Total Weekly Due</p><p className="font-semibold text-primary">{formatMoney((selectedAccount.installmentAmount || 0) + (selectedAccount.savingsAmount || 0))}</p></div>
            <div className="col-span-2"><p className="text-[10px] text-muted-foreground">Status</p><Badge className={cn(STATUS_COLORS[selectedAccount.status])}>{selectedAccount.status}</Badge></div>
          </div>
        </div>
      )}

      {/* Step 4: entry */}
      {form.accountId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Collection Date *</Label>
            <Input type="date" value={form.collectionDate} onChange={(e) => setForm({ ...form, collectionDate: e.target.value })} className="mt-1" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dedicated EMI Amount field */}
          <div>
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium text-foreground">Loan EMI Received (₹) *</Label>
              {selectedAccount && (
                <button
                  type="button"
                  onClick={() => {
                    const emiVal = String(Math.min(selectedAccount.installmentAmount, selectedAccount.outstanding))
                    const savVal = form.savingsAmount || '0'
                    const tot = (parseFloat(emiVal) || 0) + (parseFloat(savVal) || 0)
                    setForm({ ...form, emiAmount: emiVal, amount: String(tot) })
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Use EMI ({formatMoney(selectedAccount.installmentAmount)})
                </button>
              )}
            </div>
            <Input
              type="number"
              step="any"
              value={form.emiAmount}
              onChange={(e) => {
                const emiVal = e.target.value
                const emiNum = parseFloat(emiVal) || 0
                const savNum = parseFloat(form.savingsAmount) || 0
                setForm({
                  ...form,
                  emiAmount: emiVal,
                  amount: String(emiNum + savNum),
                })
              }}
              className="mt-1"
              placeholder={selectedAccount ? String(selectedAccount.installmentAmount) : '0'}
            />
            {parseFloat(form.emiAmount || '0') > 0 && selectedAccount && parseFloat(form.emiAmount) > selectedAccount.outstanding + 0.01 && (
              <p className="text-xs text-red-600 mt-1">Exceeds outstanding loan ({formatMoney(selectedAccount.outstanding)})</p>
            )}
          </div>

          {/* Dedicated Savings Amount field */}
          <div>
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium text-foreground">Savings Received (₹)</Label>
              {selectedAccount && Number(selectedAccount.savingsAmount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const savVal = String(selectedAccount.savingsAmount)
                    const emiVal = form.emiAmount || '0'
                    const tot = (parseFloat(emiVal) || 0) + (parseFloat(savVal) || 0)
                    setForm({ ...form, savingsAmount: savVal, amount: String(tot) })
                  }}
                  className="text-[11px] text-teal-600 hover:underline font-medium"
                >
                  Use Savings ({formatMoney(selectedAccount.savingsAmount || 0)})
                </button>
              )}
            </div>
            <Input
              type="number"
              step="any"
              value={form.savingsAmount}
              onChange={(e) => {
                const savVal = e.target.value
                const savNum = parseFloat(savVal) || 0
                const emiNum = parseFloat(form.emiAmount) || 0
                setForm({
                  ...form,
                  savingsAmount: savVal,
                  amount: String(emiNum + savNum),
                })
              }}
              className="mt-1"
              placeholder={selectedAccount ? String(selectedAccount.savingsAmount || 0) : '0'}
            />
          </div>

          {/* Total Amount Received summary box */}
          <div className="sm:col-span-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">Total Amount Collected</span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                EMI: ₹{form.emiAmount || '0'} + Savings: ₹{form.savingsAmount || '0'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatMoney(amount)}
              </span>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className="mt-1" placeholder="Optional notes, receipt memo..." />
          </div>

          {selectedAccount && amount > 0 && (
            <div className="sm:col-span-2 rounded-md bg-primary/10 p-2 text-sm flex justify-between">
              <span className="text-muted-foreground">New Outstanding will be:</span>
              <span className="font-bold text-primary">{formatMoney(Math.max(selectedAccount.outstanding - (parseFloat(form.emiAmount) || amount), 0))}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-dashed pb-1">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
