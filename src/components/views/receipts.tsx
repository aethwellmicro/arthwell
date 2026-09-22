'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReceiptText,
  Search,
  Printer,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  CreditCard,
  Hash,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, STATUS_COLORS, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
} from '@/components/ui/dialog'
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { ReceiptPrint } from '@/components/receipt-print'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Receipt {
  id: string
  receiptNumber: string
  collectionDate: string
  customer: { customerId: string; fullName: string; primaryMobile: string }
  account: { accountNumber: string }
  amount: number
  paymentMode: string
  collectedBy: { name: string }
  previousOutstanding: number
  currentOutstanding: number
  status: string
  receipt?: { printCount: number; branchName: string }
  remarks?: string | null
}

export function ReceiptsView({ receiptId }: { receiptId?: string }) {
  const { searchQuery, setSearchQuery } = useApp()
  const router = useRouter()
  const [items, setItems] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentMode, setPaymentMode] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [view, setView] = useState<Receipt | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Sync global search query to local search
  useEffect(() => {
    if (searchQuery) {
      setQ(searchQuery)
      setSearchQuery('')
    }
  }, [searchQuery, setSearchQuery])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ items: Receipt[] }>(`/api/collections?limit=500`)
      let filtered = data.items
      if (q) {
        const ql = q.toLowerCase()
        filtered = filtered.filter(
          (r) =>
            r.receiptNumber.toLowerCase().includes(ql) ||
            r.customer.fullName.toLowerCase().includes(ql) ||
            r.customer.primaryMobile.includes(q) ||
            r.account.accountNumber.toLowerCase().includes(ql)
        )
      }
      if (from) {
        const fd = new Date(from)
        filtered = filtered.filter((r) => new Date(r.collectionDate) >= fd)
      }
      if (to) {
        const td = new Date(to + 'T23:59:59')
        filtered = filtered.filter((r) => new Date(r.collectionDate) <= td)
      }
      if (paymentMode !== 'ALL') {
        filtered = filtered.filter((r) => r.paymentMode === paymentMode)
      }
      if (statusFilter !== 'ALL') {
        filtered = filtered.filter((r) => r.status === statusFilter)
      }
      setItems(filtered)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [q, from, to, paymentMode, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (receiptId) {
      apiFetch<Receipt>(`/api/collections/${receiptId}`)
        .then(setView)
        .catch(() => {})
    } else {
      setView(null)
    }
  }, [receiptId])

  function openReceiptPrint(r: Receipt) {
    // Open dedicated mobile/desktop print & PDF route
    window.open(`/receipts/${r.id}/print`, '_blank')
    load() // refresh print count in table
  }

  function exportCSV() {
    if (!items.length) return toast.info('No receipts to export')
    downloadCSV(
      `receipts-${new Date().toISOString().slice(0, 10)}.csv`,
      items.map((r) => ({
        receiptNumber: r.receiptNumber,
        date: formatDateTime(r.collectionDate),
        customer: r.customer.fullName,
        customerId: r.customer.customerId,
        mobile: r.customer.primaryMobile,
        account: r.account.accountNumber,
        amount: r.amount,
        paymentMode: r.paymentMode,
        collectedBy: r.collectedBy.name,
        status: r.status,
        printCount: r.receipt?.printCount ?? 0,
      }))
    )
    toast.success('Exported to CSV')
  }

  const totalAmount = items.reduce((s, r) => s + (r.status === 'SUCCESSFUL' ? r.amount : 0), 0)
  const totalPrints = items.reduce((s, r) => s + (r.receipt?.printCount ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
        <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Receipt no, customer, mobile, account…"
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-[calc(50%-5px)] sm:w-[130px]">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
        </div>
        <div className="w-[calc(50%-5px)] sm:w-[130px]">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
        </div>
        <div className="w-[calc(50%-5px)] sm:w-[110px]">
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Modes</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK">Bank</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[calc(50%-5px)] sm:w-[130px]">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="SUCCESSFUL">Successful</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto sm:ml-auto flex gap-2 pt-1 sm:pt-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="flex-1 sm:flex-initial">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!items.length} className="flex-1 sm:flex-initial">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="rounded-lg border bg-card p-3 flex items-center justify-between sm:block">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Receipts</p>
          <p className="text-xl sm:text-lg font-bold">{items.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center justify-between sm:block">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Collected</p>
          <p className="text-xl sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalAmount)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center justify-between sm:block">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Printed</p>
          <p className="text-xl sm:text-lg font-bold">{totalPrints}</p>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7 px-2 text-xs">
              Clear
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const selectedItems = items.filter((r) => selectedIds.has(r.id))
              downloadCSV(
                `receipts-${new Date().toISOString().slice(0, 10)}.csv`,
                selectedItems.map((r) => ({
                  receiptNumber: r.receiptNumber,
                  date: formatDateTime(r.collectionDate),
                  customer: r.customer.fullName,
                  account: r.account.accountNumber,
                  amount: r.amount,
                  paymentMode: r.paymentMode,
                  status: r.status,
                }))
              )
              toast.success(`Exported ${selectedIds.size} receipts`)
            }}
            className="text-xs h-8"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export Selected
          </Button>
        </div>
      )}

      {/* Main Content: Mobile Card View (< md) & Desktop Table (>= md) */}
      <SectionCard title={`Receipts (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No receipts found for the selected filters." icon={ReceiptText} />
        ) : (
          <>
            {/* MOBILE VIEW (< md): Responsive card list */}
            <div className="block md:hidden space-y-3">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border bg-card p-3.5 shadow-sm space-y-2.5 hover:border-primary/40 transition-colors"
                >
                  {/* Top: Receipt No + Status + Mode */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-primary">{r.receiptNumber}</span>
                        {r.receipt?.printCount && r.receipt.printCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-muted-foreground">
                            {r.receipt.printCount} prints
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDateTime(r.collectionDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {r.paymentMode}
                      </Badge>
                      <Badge className={cn('text-[11px]', STATUS_COLORS[r.status])}>
                        {r.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Customer + Account */}
                  <div className="border-t border-b border-dashed py-2 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Customer:
                      </span>
                      <span className="font-semibold text-right truncate max-w-[200px]">
                        {r.customer.fullName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Account:
                      </span>
                      <span className="font-mono text-muted-foreground">{r.account.accountNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Collected By:</span>
                      <span className="text-muted-foreground">{r.collectedBy.name}</span>
                    </div>
                  </div>

                  {/* Amount + Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Amount</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(r.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs gap-1"
                        onClick={() => router.push(`/receipts/${r.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1 bg-primary text-primary-foreground"
                        onClick={() => openReceiptPrint(r)}
                      >
                        <Printer className="h-3.5 w-3.5" /> Print / PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW (>= md): Full data table */}
            <div className="hidden md:block max-h-[60vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-sm zebra-table min-w-[850px]">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2.5 w-10 whitespace-nowrap">
                      <Checkbox
                        checked={items.length > 0 && items.every((r) => selectedIds.has(r.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(items.map((r) => r.id)))
                          } else {
                            setSelectedIds(new Set())
                          }
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Receipt No</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Date</th>
                    <th className="px-3 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Account</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Mode</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Collector</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 font-medium text-center whitespace-nowrap">Prints</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/40',
                        selectedIds.has(r.id) && 'bg-primary/5'
                      )}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds)
                            if (checked) next.add(r.id)
                            else next.delete(r.id)
                            setSelectedIds(next)
                          }}
                          aria-label={`Select ${r.receiptNumber}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap font-medium text-primary">
                        {r.receiptNumber}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {formatDateTime(r.collectionDate)}
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <p className="font-medium truncate" title={r.customer.fullName}>
                          {r.customer.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{r.customer.customerId}</p>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        {r.account.accountNumber}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                        {formatMoney(r.amount)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant="outline">{r.paymentMode}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.collectedBy.name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge className={cn(STATUS_COLORS[r.status])}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs whitespace-nowrap">
                        {r.receipt?.printCount ?? 0}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => router.push(`/receipts/${r.id}`)}
                            aria-label="View receipt details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => openReceiptPrint(r)}
                            aria-label="Print receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
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

      {/* Modal View Receipt Dialog (Works cleanly on mobile & desktop) */}
      <Dialog
        open={!!view}
        onOpenChange={(o) => {
          if (!o) {
            setView(null)
            router.push('/receipts')
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ReceiptText className="h-5 w-5 text-primary" /> Collection Receipt
            </DialogTitle>
          </DialogHeader>
          {view && (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-2 overflow-x-hidden">
                <ReceiptPrint
                  ref={receiptRef}
                  data={{
                    receiptNumber: view.receiptNumber,
                    branchName: (view as any).receipt?.branchName,
                    customerName: view.customer?.fullName,
                    customerId: view.customer?.customerId,
                    mobile: view.customer?.primaryMobile,
                    accountNumber: view.account?.accountNumber,
                    collectionDate: view.collectionDate,
                    amount: Number(view.amount),
                    paymentMode: view.paymentMode,
                    collectedBy: view.collectedBy?.name,
                    previousOutstanding: Number(view.previousOutstanding),
                    currentOutstanding: Number(view.currentOutstanding),
                    remarks: view.remarks ?? undefined,
                  }}
                />
              </div>
              <div className="flex flex-wrap sm:flex-nowrap justify-end gap-2 pt-2 border-t no-print">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setView(null)
                    router.push('/receipts')
                  }}
                  className="flex-1 sm:flex-initial"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => openReceiptPrint(view)}
                  className="flex-1 sm:flex-initial gap-1.5 bg-primary text-primary-foreground"
                >
                  <Printer className="h-4 w-4" /> Print / Save PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
