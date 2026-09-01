'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Landmark,
  Plus,
  Search,
  CalendarClock,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Calculator,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDate, STATUS_COLORS } from '@/lib/format'
import { useApp } from '@/lib/store'
import { calculateLoan, type InterestType, type InterestPeriod, type InstallmentFreq } from '@/lib/calc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  accountNumber: string
  customer: { customerId: string; fullName: string; primaryMobile: string; area?: string | null }
  principal: number
  interestRate: number
  interestType: string
  interestPeriod: string
  tenure: number
  installmentFreq: string
  installmentAmount: number
  totalPayable: number
  totalInterest: number
  paidAmount: number
  outstanding: number
  overdueAmount: number
  status: string
  startDate: string
  maturityDate: string
  firstDueDate: string
  remarks?: string | null
}

interface CustomerOption {
  id: string
  customerId: string
  fullName: string
  primaryMobile: string
}

const emptyForm = {
  customerId: '',
  principal: '',
  interestRate: '',
  interestType: 'FLAT' as InterestType,
  interestPeriod: 'FLAT_PERIOD' as InterestPeriod,
  tenure: '',
  installmentFreq: 'MONTHLY' as InstallmentFreq,
  startDate: new Date().toISOString().slice(0, 10),
  remarks: '',
}

export function AccountsView() {
  const { openCustomer } = useApp()
  const [items, setItems] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Account | null>(null)
  const [schedule, setSchedule] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status !== 'ALL') params.set('status', status)
      const data = await apiFetch<{ items: Account[] }>(`/api/accounts?${params}`)
      setItems(data.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [q, status])

  // live calculation preview
  const preview = useMemo(() => {
    const principal = parseFloat(form.principal)
    const rate = parseFloat(form.interestRate)
    const tenure = parseInt(form.tenure)
    if (!principal || !tenure || isNaN(rate)) return null
    try {
      return calculateLoan({
        principal,
        interestRate: rate,
        interestType: form.interestType,
        interestPeriod: form.interestPeriod,
        tenure,
        installmentFreq: form.installmentFreq,
        startDate: new Date(form.startDate),
      })
    } catch {
      return null
    }
  }, [form])

  async function loadSchedule(id: string) {
    try {
      const data = await apiFetch<{ installments: any[] }>(`/api/accounts/${id}/schedule`)
      setSchedule(data.installments)
    } catch {}
  }

  async function save() {
    if (!form.customerId) return toast.error('Select a customer.')
    setSaving(true)
    try {
      await apiFetch('/api/accounts', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Account / Loan created')
      setForm(emptyForm)
      setShowNew(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account no, customer name, mobile…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> New Account / Loan
        </Button>
      </div>

      <SectionCard title={`Accounts / Loans (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No accounts found." icon={Landmark} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Account</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium text-right">Principal</th>
                  <th className="px-3 py-2.5 font-medium">Rate / Type</th>
                  <th className="px-3 py-2.5 font-medium text-center">Tenure</th>
                  <th className="px-3 py-2.5 font-medium text-right">Installment</th>
                  <th className="px-3 py-2.5 font-medium text-right">Paid</th>
                  <th className="px-3 py-2.5 font-medium text-right">Outstanding</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => { setSelected(a); setSchedule([]); loadSchedule(a.id) }}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs">{a.accountNumber}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{a.customer.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.customer.customerId}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(a.principal)}</td>
                    <td className="px-3 py-2.5 text-xs">{a.interestRate}% · {a.interestType}</td>
                    <td className="px-3 py-2.5 text-center">{a.tenure} {a.installmentFreq.slice(0, 1)}</td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(a.installmentAmount)}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(a.paidAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(a.outstanding)}</td>
                    <td className="px-3 py-2.5"><Badge className={cn(STATUS_COLORS[a.status])}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* New account dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Create Account / Loan</DialogTitle>
          </DialogHeader>
          <NewAccountForm form={form} setForm={setForm} preview={preview} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Account'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account detail drawer */}
      <Drawer open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              {selected?.accountNumber}
              {selected && <Badge className={cn(STATUS_COLORS[selected.status])}>{selected.status}</Badge>}
            </DrawerTitle>
          </DrawerHeader>
          {selected && (
            <div className="flex flex-col">
              <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/30">
                <MiniStat icon={Wallet} label="Principal" value={formatMoney(selected.principal)} />
                <MiniStat icon={TrendingUp} label="Total Payable" value={formatMoney(selected.totalPayable)} />
                <MiniStat icon={Calculator} label="Installment" value={formatMoney(selected.installmentAmount)} tone="info" />
                <MiniStat icon={AlertTriangle} label="Outstanding" value={formatMoney(selected.outstanding)} tone="warning" />
              </div>
              <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-b">
                <Info label="Interest">{selected.interestRate}% {selected.interestType} ({selected.interestPeriod})</Info>
                <Info label="Tenure">{selected.tenure} × {selected.installmentFreq.toLowerCase()}</Info>
                <Info label="Start Date">{formatDate(selected.startDate)}</Info>
                <Info label="First Due">{formatDate(selected.firstDueDate)}</Info>
                <Info label="Maturity">{formatDate(selected.maturityDate)}</Info>
                <Info label="Customer">{selected.customer.fullName} ({selected.customer.customerId})</Info>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-semibold mb-2">Installment Schedule</p>
                <div className="max-h-[40vh] overflow-y-auto scroll-area border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Due Date</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                        <th className="px-3 py-2 font-medium text-right">Paid</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-3 py-2">{s.installNo}</td>
                          <td className="px-3 py-2">{formatDate(s.dueDate)}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(Number(s.amount))}</td>
                          <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(Number(s.paidAmount))}</td>
                          <td className="px-3 py-2"><Badge className={cn(STATUS_COLORS[s.status])}>{s.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function NewAccountForm({ form, setForm, preview }: { form: typeof emptyForm; setForm: (f: typeof emptyForm) => void; preview: any }) {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [cq, setCq] = useState('')

  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams()
      if (cq) params.set('q', cq)
      params.set('limit', '20')
      const data = await apiFetch<{ items: CustomerOption[] }>(`/api/customers?${params}`)
      setCustomers(data.items)
    }, 250)
    return () => clearTimeout(t)
  }, [cq])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
      <div className="space-y-4">
        <Field label="Customer *" full>
          <div className="space-y-2">
            <Input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search customer by name / mobile / ID…" />
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.primaryMobile} ({c.customerId})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal (₹)"><Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></Field>
          <Field label="Interest Rate (%)"><Input type="number" step="0.01" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} /></Field>
        </div>
        <Field label="Interest Type">
          <RadioGroup value={form.interestType} onValueChange={(v) => setForm({ ...form, interestType: v as InterestType })} className="flex gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="FLAT" id="flat" /><Label htmlFor="flat">Flat</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="REDUCING" id="red" /><Label htmlFor="red">Reducing Balance</Label></div>
          </RadioGroup>
        </Field>
        <Field label="Interest Period (meaning of rate %)">
          <Select value={form.interestPeriod} onValueChange={(v) => setForm({ ...form, interestPeriod: v as InterestPeriod })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FLAT_PERIOD">Flat period (one-time on principal)</SelectItem>
              <SelectItem value="MONTHLY">Monthly rate</SelectItem>
              <SelectItem value="YEARLY">Yearly rate</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tenure (installments)"><Input type="number" value={form.tenure} onChange={(e) => setForm({ ...form, tenure: e.target.value })} /></Field>
          <Field label="Installment Frequency">
            <Select value={form.installmentFreq} onValueChange={(v) => setForm({ ...form, installmentFreq: v as InstallmentFreq })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        </div>
        <Field label="Remarks"><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
      </div>

      {/* Preview */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Calculator className="h-4 w-4 text-primary" /> Live Calculation Preview</p>
        {preview ? (
          <div className="space-y-3">
            <PreviewRow label="Principal" value={formatMoney(preview.principal)} />
            <PreviewRow label="Total Interest" value={formatMoney(preview.totalInterest)} tone="warning" />
            <PreviewRow label="Total Payable" value={formatMoney(preview.totalPayable)} tone="success" big />
            <PreviewRow label="Installment Amount" value={formatMoney(preview.installmentAmount)} tone="info" big />
            <PreviewRow label="First Due Date" value={formatDate(preview.firstDueDate)} />
            <PreviewRow label="Maturity Date" value={formatDate(preview.maturityDate)} />
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Schedule (first 5)</p>
              <div className="space-y-1 max-h-32 overflow-y-auto scroll-area">
                {preview.schedule.slice(0, 5).map((s: any) => (
                  <div key={s.installNo} className="flex justify-between text-xs">
                    <span>#{s.installNo} · {formatDate(s.dueDate)}</span>
                    <span className="font-medium">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Enter principal, rate and tenure to see calculated values.</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1.5', full && 'lg:col-span-1')}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
function PreviewRow({ label, value, tone = 'default', big }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'info'; big?: boolean }) {
  const tones = { default: '', success: 'text-emerald-600 dark:text-emerald-400', warning: 'text-amber-600 dark:text-amber-400', info: 'text-teal-600 dark:text-teal-400' }
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', big ? 'text-lg' : 'text-sm', tones[tone])}>{value}</span>
    </div>
  )
}
function MiniStat({ icon: Icon, label, value, tone = 'default' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'info' }) {
  const tones: Record<string, string> = { default: 'bg-primary/10 text-primary', success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', info: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' }
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-9 w-9 rounded-md flex items-center justify-center', tones[tone])}><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  )
}
