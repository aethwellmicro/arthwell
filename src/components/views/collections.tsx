'use client'

import { useEffect, useState, useRef } from 'react'
import {
  HandCoins,
  Search,
  Plus,
  Printer,
  Undo2,
  Eye,
  Receipt as ReceiptIcon,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, todayInput, STATUS_COLORS } from '@/lib/format'
import { useApp, canReverse } from '@/lib/store'
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
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
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
  paymentMode: string
  collectedBy: { name: string; employeeCode?: string | null; role: string }
  previousOutstanding: number
  currentOutstanding: number
  status: string
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
  status: string
}

const emptyForm = {
  customerId: '',
  accountId: '',
  amount: '',
  paymentMode: 'CASH',
  collectionDate: todayInput(),
  remarks: '',
}

export function CollectionsView() {
  const { user, collectionPrefill, clearPrefill } = useApp()
  const [items, setItems] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [paymentMode, setPaymentMode] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('SUCCESSFUL')
  const [employees, setEmployees] = useState<any[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [reverseTarget, setReverseTarget] = useState<Collection | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [viewTarget, setViewTarget] = useState<Collection | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

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

  // open new collection dialog if prefill is set
  useEffect(() => {
    if (collectionPrefill) {
      setForm({ ...emptyForm, customerId: collectionPrefill.customerId || '', accountId: collectionPrefill.accountId || '' })
      setShowNew(true)
      clearPrefill()
    }
  }, [collectionPrefill, clearPrefill])

  async function save() {
    if (!form.customerId || !form.accountId || !form.amount) {
      toast.error('Customer, account and amount are required.')
      return
    }
    setSaving(true)
    try {
      const created = await apiFetch<any>('/api/collections', {
        method: 'POST',
        body: JSON.stringify(form),
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

  async function printReceipt(c: Collection) {
    try {
      await apiFetch(`/api/collections/${c.id}/receipt`, { method: 'POST' })
    } catch {}
    const full = await apiFetch<any>(`/api/collections/${c.id}`)
    setViewTarget(null)
    setReceipt(full)
    setTimeout(() => window.print(), 300)
  }

  const total = items.reduce((s, c) => s + (c.status === 'SUCCESSFUL' ? c.amount : 0), 0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Employee</Label>
          <Select value={employeeId || 'ALL'} onValueChange={(v) => setEmployeeId(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK">Bank</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SUCCESSFUL">Successful</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowNew(true) }} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> New Collection
        </Button>
      </div>

      <SectionCard title={`Collections (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No collections found for the selected filters." icon={HandCoins} />
        ) : (
          <>
          <div className="max-h-[55vh] overflow-y-auto scroll-area">
            <table className="w-full text-sm zebra-table">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Receipt</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">Account</th>
                  <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Mode</th>
                  <th className="px-3 py-2.5 font-medium">Collected By</th>
                  <th className="px-3 py-2.5 font-medium text-right">Outstanding</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.receiptNumber}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateTime(c.collectionDate)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{c.customer.fullName}</p>
                      <p className="text-xs text-muted-foreground">{c.customer.customerId}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.account.accountNumber}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(c.amount)}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline">{c.paymentMode}</Badge></td>
                    <td className="px-3 py-2.5 text-xs">{c.collectedBy.name}</td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(c.currentOutstanding)}</td>
                    <td className="px-3 py-2.5"><Badge className={cn(STATUS_COLORS[c.status])}>{c.status}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewTarget(c)} aria-label="View"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printReceipt(c)} aria-label="Print"><Printer className="h-3.5 w-3.5" /></Button>
                        {canReverse(user?.role) && c.status === 'SUCCESSFUL' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => setReverseTarget(c)} aria-label="Reverse"><Undo2 className="h-3.5 w-3.5" /></Button>
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

      {/* New collection dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> New Collection</DialogTitle>
          </DialogHeader>
          <NewCollectionForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Record Collection'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptIcon className="h-5 w-5 text-primary" /> Collection Receipt</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div>
              <div className="bg-muted/30 rounded-lg p-2">
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
              <div className="flex justify-end gap-2 mt-3 no-print">
                <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
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
              <Info label="Amount" value={formatMoney(viewTarget.amount)} />
              <Info label="Prev. Outstanding" value={formatMoney(viewTarget.previousOutstanding)} />
              <Info label="Curr. Outstanding" value={formatMoney(viewTarget.currentOutstanding)} />
              {viewTarget.remarks && <Info label="Remarks" value={viewTarget.remarks} />}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button onClick={() => printReceipt(viewTarget)}><Printer className="h-4 w-4 mr-1" /> Print</Button>
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
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-[10px] text-muted-foreground">Total Payable</p><p className="font-semibold">{formatMoney(selectedAccount.totalPayable)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Paid</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(selectedAccount.paidAmount)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Outstanding</p><p className="font-semibold text-amber-600 dark:text-amber-400">{formatMoney(selectedAccount.outstanding)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Installment Amt</p><p className="font-semibold">{formatMoney(selectedAccount.installmentAmount)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Status</p><Badge className={cn(STATUS_COLORS[selectedAccount.status])}>{selectedAccount.status}</Badge></div>
          </div>
        </div>
      )}

      {/* Step 4: entry */}
      {form.accountId && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Collection Date *</Label>
            <Input type="date" value={form.collectionDate} onChange={(e) => setForm({ ...form, collectionDate: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Amount Received *</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" placeholder={selectedAccount ? String(selectedAccount.installmentAmount) : ''} />
            {amount > 0 && selectedAccount && amount > selectedAccount.outstanding + 0.01 && (
              <p className="text-xs text-red-600 mt-1">Exceeds outstanding ({formatMoney(selectedAccount.outstanding)})</p>
            )}
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
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className="mt-1" />
          </div>
          {selectedAccount && amount > 0 && (
            <div className="col-span-2 rounded-md bg-primary/10 p-2 text-sm flex justify-between">
              <span className="text-muted-foreground">New Outstanding will be:</span>
              <span className="font-bold text-primary">{formatMoney(Math.max(selectedAccount.outstanding - amount, 0))}</span>
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
