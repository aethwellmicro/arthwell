'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ReceiptText, Search, Printer, Eye, RefreshCw, FileSpreadsheet } from 'lucide-react'
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
  DialogFooter,
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

import { useRouter } from 'next/navigation'

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
        filtered = filtered.filter((r) =>
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
      apiFetch<Receipt>(`/api/collections/${receiptId}`).then(setView).catch(() => {})
    } else {
      setView(null)
    }
  }, [receiptId])

  async function printReceipt(r: Receipt) {
    try {
      await apiFetch(`/api/collections/${r.id}/receipt`, { method: 'POST' })
    } catch {}
    router.push(`/receipts/${r.id}`)
    setTimeout(() => window.print(), 500)
    load() // refresh print count
  }

  function exportCSV() {
    if (!items.length) return toast.info('No receipts to export')
    downloadCSV(`receipts-${new Date().toISOString().slice(0, 10)}.csv`, items.map((r) => ({
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
    })))
    toast.success('Exported to CSV')
  }

  const totalAmount = items.reduce((s, r) => s + (r.status === 'SUCCESSFUL' ? r.amount : 0), 0)
  const totalPrints = items.reduce((s, r) => s + (r.receipt?.printCount ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Receipt no, customer, mobile, account…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px]" />
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
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SUCCESSFUL">Successful</SelectItem>
              <SelectItem value="REVERSED">Reversed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!items.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Receipts</p>
          <p className="text-lg font-bold">{items.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Amount</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totalAmount)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Prints</p>
          <p className="text-lg font-bold">{totalPrints}</p>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            const selectedItems = items.filter((r) => selectedIds.has(r.id))
            downloadCSV(`receipts-${new Date().toISOString().slice(0, 10)}.csv`, selectedItems.map((r) => ({
              receiptNumber: r.receiptNumber,
              date: formatDateTime(r.collectionDate),
              customer: r.customer.fullName,
              account: r.account.accountNumber,
              amount: r.amount,
              paymentMode: r.paymentMode,
              status: r.status,
            })))
            toast.success(`Exported ${selectedIds.size} receipts`)
          }}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export Selected
          </Button>
        </div>
      )}

      <SectionCard title={`Receipts (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No receipts found for the selected filters." icon={ReceiptText} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area">
            <table className="w-full text-sm zebra-table">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 w-10">
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
                  <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Mode</th>
                  <th className="px-3 py-2.5 font-medium">Collector</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-center">Prints</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={cn('border-b last:border-0', selectedIds.has(r.id) && 'bg-primary/5')}>
                    <td className="px-3 py-2.5">
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
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{r.receiptNumber}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{formatDateTime(r.collectionDate)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{r.customer.fullName}</p>
                      <p className="text-xs text-muted-foreground">{r.customer.customerId}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{r.account.accountNumber}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(r.amount)}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline">{r.paymentMode}</Badge></td>
                    <td className="px-3 py-2.5 text-xs">{r.collectedBy.name}</td>
                    <td className="px-3 py-2.5"><Badge className={cn(STATUS_COLORS[r.status])}>{r.status}</Badge></td>
                    <td className="px-3 py-2.5 text-center text-xs">{r.receipt?.printCount ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => router.push(`/receipts/${r.id}`)} aria-label="View"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printReceipt(r)} aria-label="Print"><Printer className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Dialog open={!!view} onOpenChange={(o) => { if (!o) { setView(null); router.push('/receipts') } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /> Receipt</DialogTitle>
          </DialogHeader>
          {view && (
            <div>
              <div className="bg-muted/30 rounded-lg p-2">
                <ReceiptPrint ref={receiptRef} data={{
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
                }} />
              </div>
              <div className="flex justify-end gap-2 mt-3 no-print">
                <Button variant="outline" onClick={() => { setView(null); router.push('/receipts') }}>Close</Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
