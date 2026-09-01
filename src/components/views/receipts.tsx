'use client'

import { useEffect, useState, useRef } from 'react'
import { ReceiptText, Search, Printer, Eye } from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, STATUS_COLORS, formatDateInput } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

export function ReceiptsView() {
  const [items, setItems] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [view, setView] = useState<Receipt | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ items: Receipt[] }>(`/api/collections?limit=500`)
      let filtered = data.items
      if (q) filtered = filtered.filter((r) => r.receiptNumber.toLowerCase().includes(q.toLowerCase()) || r.customer.fullName.toLowerCase().includes(q.toLowerCase()))
      setItems(filtered)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [q])

  async function printReceipt(r: Receipt) {
    try {
      await apiFetch(`/api/collections/${r.id}/receipt`, { method: 'POST' })
    } catch {}
    const full = await apiFetch<any>(`/api/collections/${r.id}`)
    setView(full)
    setTimeout(() => window.print(), 300)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Receipt no. or customer name…" className="pl-8" />
          </div>
        </div>
      </div>

      <SectionCard title={`Receipts (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No receipts found." icon={ReceiptText} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area">
            <table className="w-full text-sm zebra-table">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Receipt No</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Mode</th>
                  <th className="px-3 py-2.5 font-medium">Collector</th>
                  <th className="px-3 py-2.5 font-medium text-center">Prints</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2.5 font-mono text-xs">{r.receiptNumber}</td>
                    <td className="px-3 py-2.5 text-xs">{formatDateTime(r.collectionDate)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{r.customer.fullName}</p>
                      <p className="text-xs text-muted-foreground">{r.customer.customerId}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.account.accountNumber}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(r.amount)}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline">{r.paymentMode}</Badge></td>
                    <td className="px-3 py-2.5 text-xs">{r.collectedBy.name}</td>
                    <td className="px-3 py-2.5 text-center text-xs">{r.receipt?.printCount ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setView(r)} aria-label="View"><Eye className="h-3.5 w-3.5" /></Button>
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

      <Dialog open={!!view} onOpenChange={(o) => { if (!o) setView(null) }}>
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
                  remarks: view.remarks,
                }} />
              </div>
              <div className="flex justify-end gap-2 mt-3 no-print">
                <Button variant="outline" onClick={() => setView(null)}>Close</Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
