'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  ShieldAlert,
  FileSpreadsheet,
  Clock,
  Lock,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, formatDate, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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

interface BusinessDateSummary {
  id: string
  businessDate: string
  status: 'OPEN' | 'RECONCILIATION_PENDING' | 'CLOSED'
  openedAt: string
  openedBy: { id: string; name: string }
  closedAt?: string | null
  closedBy?: { id: string; name: string } | null
  openingCash: number
  closingCash: number
  actualCashInHand: number
  cashDifference: number
  differenceReason?: string | null
  reconciliationStatus: string
  notes?: string | null
  cashCollections: number
  otherCollections: number
  totalCollections: number
  cashDisbursements: number
  totalDisbursements: number
  bankDeposits: number
  expectedClosingCash: number
}

interface EODHistoryItem {
  id: string
  businessDate: string
  status: string
  openingCash: number
  closingCash: number
  actualCashInHand: number
  cashDifference: number
  differenceReason?: string | null
  reconciliationStatus: string
  openedBy: { name: string }
  closedBy?: { name: string } | null
  closedAt?: string | null
  _count: { collections: number; accounts: number; bankDeposits: number }
}

export function EODView() {
  const { user } = useApp()
  const [data, setData] = useState<{ active: any; summary: BusinessDateSummary | null } | null>(null)
  const [history, setHistory] = useState<EODHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

  // EOD Modal State
  const [physicalCash, setPhysicalCash] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [eodNotes, setEodNotes] = useState('')

  // 10-step EOD checklist
  const [checklist, setChecklist] = useState({
    collectionsVerified: false,
    disbursementsVerified: false,
    depositsVerified: false,
    receiptsVerified: false,
    adjustmentsVerified: false,
    queueCleared: false,
    expectedCashVerified: false,
    cashCounted: false,
    differenceResolved: false,
    eodReviewed: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cur, hist] = await Promise.all([
        apiFetch<{ active: any; summary: BusinessDateSummary | null }>('/api/business-date/eod'),
        apiFetch<{ items: EODHistoryItem[] }>('/api/business-date/eod?history=true'),
      ])
      setData(cur)
      setHistory(hist.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const summary = data?.summary
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER'

  // Live difference in modal
  const enteredCashNum = parseFloat(physicalCash) || 0
  const expectedCashNum = summary?.expectedClosingCash || 0
  const difference = Math.round((enteredCashNum - expectedCashNum) * 100) / 100

  // Checklist validation
  const allChecked = Object.values(checklist).every(Boolean)

  async function handleCloseDay() {
    if (!summary) return
    if (!physicalCash || isNaN(parseFloat(physicalCash))) {
      return toast.error('Physical cash counted must be entered.')
    }
    if (difference !== 0 && !differenceReason.trim()) {
      return toast.error(`A cash difference of ${formatMoney(Math.abs(difference))} requires an authorized explanation.`)
    }
    if (!allChecked) {
      return toast.error('All 10 verification steps in the EOD checklist must be completed.')
    }

    setClosing(true)
    try {
      const res = await apiFetch<any>('/api/business-date/eod', {
        method: 'POST',
        body: JSON.stringify({
          actualCashInHand: enteredCashNum,
          differenceReason: differenceReason.trim() || undefined,
          notes: eodNotes.trim() || undefined,
        }),
      })
      toast.success(res.message || 'Business day closed successfully!')
      setShowCloseModal(false)
      setPhysicalCash('')
      setDifferenceReason('')
      setEodNotes('')
      // reset checklist
      setChecklist({
        collectionsVerified: false,
        disbursementsVerified: false,
        depositsVerified: false,
        receiptsVerified: false,
        adjustmentsVerified: false,
        queueCleared: false,
        expectedCashVerified: false,
        cashCounted: false,
        differenceResolved: false,
        eodReviewed: false,
      })
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Day End &amp; EOD Cash Reconciliation</h2>
              {summary && (
                <Badge
                  className={cn(
                    'font-mono text-xs',
                    summary.status === 'OPEN'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  )}
                >
                  ● {summary.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active Business Date:{' '}
              <span className="font-mono font-semibold text-foreground">
                {summary ? summary.businessDate : 'Not Initialized'}
              </span>{' '}
              · Opened by {summary?.openedBy?.name || 'System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="flex-1 sm:flex-initial">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
          {isManagerOrAdmin && summary && summary.status === 'OPEN' && (
            <Button
              size="sm"
              onClick={() => setShowCloseModal(true)}
              className="flex-1 sm:flex-initial gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Lock className="h-3.5 w-3.5" /> Execute Day End (EOD)
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingRows rows={5} />
      ) : !summary ? (
        <EmptyState
          icon={CalendarClock}
          message="No active business date is open. Initialized business date will be established automatically upon first transaction."
        />
      ) : (
        <>
          {/* Visual Cash Flow Waterfall (Standardized with other modules) */}
          <SectionCard title="Authoritative Cash Reconciliation Waterfall">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* 1. Opening Cash */}
              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-primary" /> Opening Cash
                </p>
                <p className="text-lg font-bold mt-1 text-foreground">{formatMoney(summary.openingCash)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Start of business day</p>
              </div>

              {/* 2. Cash Collections (+) */}
              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5" /> + Cash Collections
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatMoney(summary.cashCollections)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  UPI/Bank: {formatMoney(summary.otherCollections)}
                </p>
              </div>

              {/* 3. Disbursements (-) */}
              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <p className="text-[10px] uppercase tracking-wide text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> - Disbursements
                </p>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {formatMoney(summary.cashDisbursements)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Physical loans issued</p>
              </div>

              {/* 4. Bank Deposits (-) */}
              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                  <Landmark className="h-3.5 w-3.5" /> - Bank Deposits
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {formatMoney(summary.bankDeposits)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cash sent to bank</p>
              </div>

              {/* 5. Expected Closing Cash (=) */}
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 shadow-2xs">
                <p className="text-[10px] uppercase tracking-wide text-primary font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> = Expected Cash
                </p>
                <p className="text-lg font-bold text-primary mt-1">
                  {formatMoney(summary.expectedClosingCash)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Must balance physical count</p>
              </div>
            </div>
          </SectionCard>

          {/* Historical Closed Business Dates */}
          <SectionCard title={`EOD Closing History (${history.length})`}>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No historical EOD records yet.</p>
            ) : (
              <div className="max-h-[40vh] overflow-y-auto scroll-area overflow-x-auto">
                <table className="w-full text-sm zebra-table min-w-[760px]">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2.5 font-medium text-xs">Business Date</th>
                      <th className="px-3 py-2.5 font-medium text-xs text-right">Opening Cash</th>
                      <th className="px-3 py-2.5 font-medium text-xs text-right">Expected Closing</th>
                      <th className="px-3 py-2.5 font-medium text-xs text-right">Actual Counted</th>
                      <th className="px-3 py-2.5 font-medium text-xs text-right">Difference</th>
                      <th className="px-3 py-2.5 font-medium text-xs">Reconciliation</th>
                      <th className="px-3 py-2.5 font-medium text-xs">Closed By</th>
                      <th className="px-3 py-2.5 font-medium text-xs">Closed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold">{h.businessDate}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatMoney(h.openingCash)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatMoney(h.closingCash)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatMoney(h.actualCashInHand)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right font-bold',
                            h.cashDifference !== 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {h.cashDifference !== 0 ? formatMoney(h.cashDifference) : '₹0.00'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              h.reconciliationStatus === 'BALANCED'
                                ? 'text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                                : 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40'
                            )}
                          >
                            {h.reconciliationStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{h.closedBy?.name || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(h.closedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* 10-Step EOD Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Lock className="h-5 w-5 text-primary" /> Execute Day End (EOD) Closing
            </DialogTitle>
          </DialogHeader>

          {summary && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Business Date</span>
                  <span className="font-mono font-bold text-sm">{summary.businessDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Opening Cash</span>
                  <span className="font-bold">{formatMoney(summary.openingCash)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Cash Collected</span>
                  <span className="font-bold text-emerald-600">{formatMoney(summary.cashCollections)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Expected Cash</span>
                  <span className="font-bold text-primary text-sm">{formatMoney(summary.expectedClosingCash)}</span>
                </div>
              </div>

              {/* Physical Cash Input */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-semibold">1. Enter Physical Cash in Hand (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={physicalCash}
                  onChange={(e) => setPhysicalCash(e.target.value)}
                  placeholder="e.g. 50000"
                  className="font-mono text-base font-bold"
                />

                {/* Live Difference Display */}
                {physicalCash !== '' && (
                  <div
                    className={cn(
                      'p-2.5 rounded-md border text-xs flex items-center justify-between',
                      difference === 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    )}
                  >
                    <span className="font-medium">
                      {difference === 0 ? '✓ Cash is perfectly balanced.' : '⚠ Cash discrepancy detected!'}
                    </span>
                    <span className="font-bold font-mono">
                      Difference: {difference > 0 ? `+${formatMoney(difference)}` : formatMoney(difference)}
                    </span>
                  </div>
                )}
              </div>

              {/* Difference Reason (Mandatory if difference != 0) */}
              {difference !== 0 && physicalCash !== '' && (
                <div className="space-y-1.5 p-3 rounded-md border border-amber-300 bg-amber-50/60 dark:bg-amber-950/30">
                  <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Mandatory Discrepancy Reason *
                  </Label>
                  <Textarea
                    value={differenceReason}
                    onChange={(e) => setDifferenceReason(e.target.value)}
                    placeholder="Provide detailed authorized reason for cash difference before closing..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              )}

              {/* 10-Step Verification Checklist (Section 19 & 23 Acceptance Criteria) */}
              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs font-semibold">2. Mandatory EOD Verification Checklist</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded-lg border">
                  {[
                    { key: 'collectionsVerified', label: '1. All collections recorded & verified' },
                    { key: 'disbursementsVerified', label: '2. All loan disbursements verified' },
                    { key: 'depositsVerified', label: '3. All bank deposits recorded' },
                    { key: 'receiptsVerified', label: '4. System receipts counter matched' },
                    { key: 'adjustmentsVerified', label: '5. Cash adjustments reviewed' },
                    { key: 'queueCleared', label: '6. Pending transaction issues cleared' },
                    { key: 'expectedCashVerified', label: '7. Expected closing cash verified' },
                    { key: 'cashCounted', label: '8. Physical cash counted in vault' },
                    { key: 'differenceResolved', label: '9. Cash difference resolved or justified' },
                    { key: 'eodReviewed', label: '10. Confirm Day End & lock date' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        id={item.key}
                        checked={(checklist as any)[item.key]}
                        onCheckedChange={(checked) =>
                          setChecklist({ ...checklist, [item.key]: Boolean(checked) })
                        }
                      />
                      <label htmlFor={item.key} className="cursor-pointer text-muted-foreground select-none">
                        {item.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">General EOD Notes</Label>
                <Input
                  value={eodNotes}
                  onChange={(e) => setEodNotes(e.target.value)}
                  placeholder="Optional day-end remarks..."
                  className="text-xs"
                />
              </div>

              <div className="p-2.5 rounded bg-muted/30 border text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">Important EOD Locking Rules:</p>
                <p>
                  Once Day End is confirmed, {summary.businessDate} will be permanently{' '}
                  <span className="font-bold text-foreground">CLOSED and locked</span>. The system will
                  automatically open the next business date.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button variant="outline" onClick={() => setShowCloseModal(false)} disabled={closing}>
              Cancel
            </Button>
            <Button
              onClick={handleCloseDay}
              disabled={closing || !allChecked || !physicalCash}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {closing ? 'Closing Day End…' : 'Confirm & Close Business Day'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
