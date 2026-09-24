'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Banknote,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  Plus,
  Calendar,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDateTime, formatDate, downloadCSV } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

interface TransactionItem {
  id: string
  txNumber: string
  type: 'COLLECTION' | 'DISBURSEMENT' | 'BANK_DEPOSIT' | 'CHARGE_RECOVERY' | 'INVESTMENT' | 'EXPENSE'
  side?: 'DEBIT' | 'CREDIT'
  date: string
  businessDate: string
  customerName: string
  customerId: string
  accountNumber: string
  amount: number
  paymentMode: string
  createdBy: string
  status: string
  remarks?: string | null
}

export function TransactionsView() {
  const [items, setItems] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [bDateFilter, setBDateFilter] = useState('')

  // New Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositForm, setDepositForm] = useState({
    bankAccount: '',
    amount: '',
    referenceNumber: '',
    depositDate: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [savingDeposit, setSavingDeposit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (bDateFilter) params.set('businessDate', bDateFilter)
      params.set('limit', '300')
      const data = await apiFetch<{ items: TransactionItem[] }>(`/api/transactions?${params}`)
      let filtered = data.items
      if (q) {
        const ql = q.toLowerCase()
        filtered = filtered.filter(
          (t) =>
            t.txNumber.toLowerCase().includes(ql) ||
            t.customerName.toLowerCase().includes(ql) ||
            t.accountNumber.toLowerCase().includes(ql) ||
            t.createdBy.toLowerCase().includes(ql)
        )
      }
      setItems(filtered)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, bDateFilter, q])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreateDeposit() {
    if (!depositForm.bankAccount.trim()) return toast.error('Bank account is required.')
    const amt = parseFloat(depositForm.amount)
    if (isNaN(amt) || amt <= 0) return toast.error('Valid deposit amount is required.')

    setSavingDeposit(true)
    try {
      await apiFetch('/api/bank-deposits', {
        method: 'POST',
        body: JSON.stringify(depositForm),
      })
      toast.success('Bank deposit recorded successfully!')
      setShowDepositModal(false)
      setDepositForm({
        bankAccount: '',
        amount: '',
        referenceNumber: '',
        depositDate: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingDeposit(false)
    }
  }

  function exportCSV() {
    if (!items.length) return toast.info('No transactions to export')
    downloadCSV(
      `daily-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      items.map((t) => ({
        txNumber: t.txNumber,
        type: t.type,
        businessDate: t.businessDate,
        date: formatDateTime(t.date),
        party: t.customerName,
        account: t.accountNumber,
        amount: t.amount,
        mode: t.paymentMode,
        createdBy: t.createdBy,
        status: t.status,
      }))
    )
    toast.success('Exported to CSV')
  }

  const totalInflows = items
    .filter((t) => (t.type === 'COLLECTION' || t.type === 'CHARGE_RECOVERY' || t.type === 'INVESTMENT') && t.status === 'SUCCESSFUL')
    .reduce((s, t) => s + t.amount, 0)
  const totalOutflows = items
    .filter((t) => (t.type === 'DISBURSEMENT' || t.type === 'EXPENSE'))
    .reduce((s, t) => s + t.amount, 0)
  const totalInvestments = items
    .filter((t) => t.type === 'INVESTMENT')
    .reduce((s, t) => s + t.amount, 0)
  const totalExpenses = items
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0)
  const totalDeposits = items
    .filter((t) => t.type === 'BANK_DEPOSIT')
    .reduce((s, t) => s + t.amount, 0)
  const totalRecoveredCharges = items
    .filter((t) => t.type === 'CHARGE_RECOVERY')
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Filter and Action bar */}
      <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
        <div className="flex-1 min-w-[200px] w-full sm:w-auto relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ref #, customer/bank, account, officer…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="w-[calc(50%-5px)] sm:w-[170px]">
          <Label className="text-xs text-muted-foreground">Transaction Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="COLLECTION">Collections (Credit +)</SelectItem>
              <SelectItem value="INVESTMENT">Investments (Credit +)</SelectItem>
              <SelectItem value="CHARGE_RECOVERY">Recovered Charges (Credit +)</SelectItem>
              <SelectItem value="EXPENSE">Expenses (Debit -)</SelectItem>
              <SelectItem value="DISBURSEMENT">Disbursements (Debit -)</SelectItem>
              <SelectItem value="BANK_DEPOSIT">Bank Deposits (Debit -)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[calc(50%-5px)] sm:w-[140px]">
          <Label className="text-xs text-muted-foreground">Business Date</Label>
          <Input
            type="date"
            value={bDateFilter}
            onChange={(e) => setBDateFilter(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="w-full sm:w-auto sm:ml-auto flex gap-2 pt-1 sm:pt-0">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="flex-1 sm:flex-initial">
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!items.length} className="flex-1 sm:flex-initial">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button
            size="sm"
            onClick={() => setShowDepositModal(true)}
            className="flex-1 sm:flex-initial gap-1 bg-primary text-primary-foreground font-semibold"
          >
            <Plus className="h-4 w-4" /> Bank Deposit
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-medium">
            Total Inflows (Cr)
          </p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            +{formatMoney(totalInflows)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-indigo-600 dark:text-indigo-400 font-medium">
            Investments (Cr)
          </p>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            +{formatMoney(totalInvestments)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-teal-600 dark:text-teal-400 font-medium">
            Recovered Charges
          </p>
          <p className="text-lg font-bold text-teal-600 dark:text-teal-400">
            +{formatMoney(totalRecoveredCharges)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium">
            Expenses (Dr)
          </p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
            -{formatMoney(totalExpenses)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-rose-600 dark:text-rose-400 font-medium">
            Disbursements (Dr)
          </p>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
            -{formatMoney(totalOutflows)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-medium">
            Bank Deposits (Dr)
          </p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            -{formatMoney(totalDeposits)}
          </p>
        </div>
      </div>

      {/* Main Transactions List */}
      <SectionCard title={`Daily Transactions (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No transactions found for the selected criteria." icon={Banknote} />
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="block md:hidden space-y-3">
              {items.map((t) => {
                const isCredit = t.side === 'CREDIT' || t.type === 'COLLECTION' || t.type === 'CHARGE_RECOVERY' || t.type === 'INVESTMENT'
                return (
                  <div key={t.id} className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">{t.txNumber}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              t.type === 'COLLECTION'
                                ? 'text-emerald-700 border-emerald-300'
                                : t.type === 'INVESTMENT'
                                ? 'text-indigo-700 border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                                : t.type === 'CHARGE_RECOVERY'
                                ? 'text-teal-700 border-teal-300 bg-teal-50 dark:bg-teal-950/40'
                                : t.type === 'EXPENSE'
                                ? 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40'
                                : t.type === 'DISBURSEMENT'
                                ? 'text-rose-700 border-rose-300'
                                : 'text-blue-700 border-blue-300'
                            )}
                          >
                            {t.type === 'CHARGE_RECOVERY' ? 'RECOVERED CHARGES' : t.type}
                          </Badge>
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0 font-bold',
                              isCredit
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            )}
                          >
                            {isCredit ? 'Credit (Cr)' : 'Debit (Dr)'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {formatDateTime(t.date)} (B-Date: {t.businessDate})
                        </p>
                      </div>
                      <p
                        className={cn(
                          'text-sm font-bold',
                          isCredit ? 'text-emerald-600' : 'text-rose-600'
                        )}
                      >
                        {isCredit ? '+' : '-'}
                        {formatMoney(t.amount)}
                      </p>
                    </div>

                    <div className="border-t border-dashed pt-2 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Party:</span>
                        <span className="font-medium text-right truncate max-w-[200px]">{t.customerName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Account / Ref:</span>
                        <span className="font-mono text-muted-foreground">{t.accountNumber}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Officer / Mode:</span>
                        <span className="text-muted-foreground">
                          {t.createdBy} · {t.paymentMode}
                        </span>
                      </div>
                      {t.remarks && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Particulars:</span>
                          <span className="text-muted-foreground italic truncate max-w-[220px]">{t.remarks}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block max-h-[60vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-xs zebra-table min-w-[920px]">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Tx #</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Type</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">Side</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Time</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Business Date</th>
                    <th className="px-3 py-2.5 font-medium">Customer / Party</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Account / Ref</th>
                    <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Mode</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Staff / Channel</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const isCredit = t.side === 'CREDIT' || t.type === 'COLLECTION' || t.type === 'CHARGE_RECOVERY' || t.type === 'INVESTMENT'
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono font-medium text-primary whitespace-nowrap">
                          {t.txNumber}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              t.type === 'COLLECTION'
                                ? 'text-emerald-700 border-emerald-300'
                                : t.type === 'INVESTMENT'
                                ? 'text-indigo-700 border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40'
                                : t.type === 'CHARGE_RECOVERY'
                                ? 'text-teal-700 border-teal-300 bg-teal-50 dark:bg-teal-950/40'
                                : t.type === 'EXPENSE'
                                ? 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40'
                                : t.type === 'DISBURSEMENT'
                                ? 'text-rose-700 border-rose-300'
                                : 'text-blue-700 border-blue-300'
                            )}
                          >
                            {t.type === 'CHARGE_RECOVERY' ? 'RECOVERED CHARGES' : t.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0 font-bold',
                              isCredit
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            )}
                          >
                            {isCredit ? 'Credit (Cr)' : 'Debit (Dr)'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(t.date)}</td>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{t.businessDate}</td>
                        <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={t.customerName}>
                          {t.customerName}
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {t.accountNumber}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-bold whitespace-nowrap',
                            isCredit ? 'text-emerald-600' : 'text-rose-600'
                          )}
                        >
                          {isCredit ? '+' : '-'}
                          {formatMoney(t.amount)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.paymentMode}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{t.createdBy}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge className="text-[10px] bg-slate-100 text-slate-800 border-slate-200">
                            {t.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {/* Record Bank Deposit Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="w-[96vw] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Landmark className="h-5 w-5 text-primary" /> Record Bank Deposit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <div className="p-2.5 rounded bg-muted/30 border text-xs text-muted-foreground">
              Bank deposits represent cash deposited from field collections into official company bank accounts.
              This reduces vault cash and is accounted for in EOD cash balance.
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bank Account *</Label>
              <Input
                value={depositForm.bankAccount}
                onChange={(e) => setDepositForm({ ...depositForm, bankAccount: e.target.value })}
                placeholder="e.g. HDFC Bank - 50200012345678"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Deposit Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                placeholder="e.g. 50000"
                className="font-bold font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Challan / Ref #</Label>
                <Input
                  value={depositForm.referenceNumber}
                  onChange={(e) => setDepositForm({ ...depositForm, referenceNumber: e.target.value })}
                  placeholder="e.g. CHL-984321"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deposit Date</Label>
                <Input
                  type="date"
                  value={depositForm.depositDate}
                  onChange={(e) => setDepositForm({ ...depositForm, depositDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                placeholder="Optional deposit details..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <Button variant="outline" onClick={() => setShowDepositModal(false)} disabled={savingDeposit}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeposit} disabled={savingDeposit} className="bg-primary text-primary-foreground font-semibold">
              {savingDeposit ? 'Recording…' : 'Record Deposit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
