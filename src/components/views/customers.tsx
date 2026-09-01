'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Briefcase,
  UserPlus,
  X,
  HandCoins,
  Landmark,
  Pencil,
} from 'lucide-react'
import { apiFetch, formatMoney, formatDate, STATUS_COLORS, ROLE_LABELS } from '@/lib/format'
import { useApp } from '@/lib/store'
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SectionCard, EmptyState, LoadingRows, StatCard } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Customer {
  id: string
  customerId: string
  fullName: string
  primaryMobile: string
  alternateMobile?: string | null
  address?: string | null
  city?: string | null
  area?: string | null
  occupation?: string | null
  referenceName?: string | null
  referenceMobile?: string | null
  idType?: string | null
  idNumber?: string | null
  status: string
  createdAt: string
  createdBy?: { name: string }
  totalPayable: number
  totalCollected: number
  outstanding: number
  _count?: { accounts: number; collections: number }
}

interface Account {
  id: string
  accountNumber: string
  principal: number
  totalPayable: number
  paidAmount: number
  outstanding: number
  status: string
  installmentAmount: number
  interestType: string
  interestRate: number
  tenure: number
  startDate: string
  maturityDate: string
}

interface Payment {
  id: string
  receiptNumber: string
  accountNumber: string
  collectionDate: string
  amount: number
  paymentMode: string
  collectedBy: string
  previousOutstanding: number
  currentOutstanding: number
  balanceAfter: number
  status: string
  remarks?: string
}

const emptyForm = {
  fullName: '',
  primaryMobile: '',
  alternateMobile: '',
  address: '',
  city: '',
  area: '',
  occupation: '',
  referenceName: '',
  referenceMobile: '',
  idType: 'Aadhaar',
  idNumber: '',
}

export function CustomersView() {
  const { searchQuery, selectedCustomerId, openCustomer, startCollection, setSearchQuery } = useApp()
  const [items, setItems] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [area, setArea] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status !== 'ALL') params.set('status', status)
      if (area) params.set('area', area)
      params.set('limit', '500')
      const data = await apiFetch<{ items: Customer[] }>(`/api/customers?${params}`)
      setItems(data.items)
      setPage(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [q, status, area])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  useEffect(() => {
    if (searchQuery) {
      setQ(searchQuery)
      setSearchQuery('')
    }
  }, [searchQuery, setSearchQuery])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (selectedCustomerId) {
      apiFetch<Customer>(`/api/customers/${selectedCustomerId}`).then(setSelected).catch(() => {})
    }
  }, [selectedCustomerId])

  async function save() {
    if (!form.fullName || !form.primaryMobile) {
      toast.error('Name and primary mobile are required.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/customers', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Customer registered')
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile, customer ID…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Area</Label>
          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area" className="w-[160px]" />
        </div>
        <Button onClick={() => setShowNew(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> New Customer
        </Button>
      </div>

      <SectionCard title={`Customers (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No customers found. Add your first customer." icon={Users} />
        ) : (
          <>
            <div className="max-h-[55vh] overflow-y-auto scroll-area">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Customer ID</th>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Mobile</th>
                    <th className="px-4 py-2.5 font-medium">Area</th>
                    <th className="px-4 py-2.5 font-medium text-center">Accounts</th>
                    <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{c.customerId}</td>
                      <td className="px-4 py-2.5 font-medium">{c.fullName}</td>
                      <td className="px-4 py-2.5">{c.primaryMobile}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.area || '—'}</td>
                      <td className="px-4 py-2.5 text-center">{c._count?.accounts ?? 0}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(c.outstanding)}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn(STATUS_COLORS[c.status])}>{c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
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

      {/* New customer dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Register New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Full Name *"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Primary Mobile *"><Input value={form.primaryMobile} onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })} /></Field>
            <Field label="Alternate Mobile"><Input value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} /></Field>
            <Field label="Occupation"><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></Field>
            <Field label="Address" full><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Area"><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
            <Field label="Reference Name"><Input value={form.referenceName} onChange={(e) => setForm({ ...form, referenceName: e.target.value })} /></Field>
            <Field label="Reference Mobile"><Input value={form.referenceMobile} onChange={(e) => setForm({ ...form, referenceMobile: e.target.value })} /></Field>
            <Field label="KYC Type">
              <Select value={form.idType} onValueChange={(v) => setForm({ ...form, idType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                  <SelectItem value="PAN">PAN</SelectItem>
                  <SelectItem value="Voter ID">Voter ID</SelectItem>
                  <SelectItem value="Driving License">Driving License</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="KYC Number" full><Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Register Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer detail drawer */}
      <Drawer open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); openCustomer('') } }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {selected?.fullName}
              {selected && <Badge className={cn(STATUS_COLORS[selected.status])}>{selected.status}</Badge>}
            </DrawerTitle>
          </DrawerHeader>
          {selected && (
            <CustomerDetail
              customer={selected}
              onCollect={() => { startCollection(selected.id); setSelected(null) }}
              onUpdated={(c) => setSelected(c)}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1.5', full && 'sm:col-span-2')}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function CustomerDetail({ customer, onCollect, onUpdated }: { customer: Customer; onCollect: () => void; onUpdated: (c: Customer) => void }) {
  const [tab, setTab] = useState('overview')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [loadingP, setLoadingP] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoadingA(true)
    apiFetch<{ items: Account[] }>(`/api/customers/${customer.id}/accounts`).then((d) => setAccounts(d.items)).finally(() => setLoadingA(false))
  }, [customer.id])

  useEffect(() => {
    if (tab === 'payments') {
      setLoadingP(true)
      apiFetch<{ items: Payment[] }>(`/api/customers/${customer.id}/payments`).then((d) => setPayments(d.items)).finally(() => setLoadingP(false))
    }
  }, [tab, customer.id])

  function openEdit() {
    setEditForm({
      fullName: customer.fullName,
      primaryMobile: customer.primaryMobile,
      alternateMobile: customer.alternateMobile || '',
      address: customer.address || '',
      city: customer.city || '',
      area: customer.area || '',
      occupation: customer.occupation || '',
      referenceName: customer.referenceName || '',
      referenceMobile: customer.referenceMobile || '',
      idType: customer.idType || 'Aadhaar',
      idNumber: customer.idNumber || '',
      status: customer.status,
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const updated = await apiFetch<Customer>(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      toast.success('Customer updated')
      setShowEdit(false)
      // re-fetch enriched detail
      const full = await apiFetch<Customer>(`/api/customers/${customer.id}`)
      onUpdated(full)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/30">
        <DetailItem icon={Phone} label="Mobile" value={customer.primaryMobile} />
        <DetailItem icon={MapPin} label="Area" value={customer.area || '—'} />
        <DetailItem icon={Briefcase} label="Occupation" value={customer.occupation || '—'} />
        <DetailItem icon={Users} label="Customer ID" value={customer.customerId} />
      </div>
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/20">
        <MiniStat label="Total Payable" value={formatMoney(customer.totalPayable)} />
        <MiniStat label="Total Collected" value={formatMoney(customer.totalCollected)} tone="success" />
        <MiniStat label="Outstanding" value={formatMoney(customer.outstanding)} tone="warning" />
        <div className="flex items-end gap-2">
          <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
          <Button size="sm" onClick={onCollect}><HandCoins className="h-3.5 w-3.5 mr-1" /> Collect</Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="px-4 pt-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow label="Alternate Mobile" value={customer.alternateMobile || '—'} />
            <InfoRow label="City" value={customer.city || '—'} />
            <InfoRow label="Address" value={customer.address || '—'} />
            <InfoRow label="Reference" value={customer.referenceName ? `${customer.referenceName} (${customer.referenceMobile})` : '—'} />
            <InfoRow label="KYC" value={customer.idType ? `${customer.idType}: ${customer.idNumber}` : '—'} />
            <InfoRow label="Registered On" value={formatDate(customer.createdAt)} />
            <InfoRow label="Created By" value={customer.createdBy?.name || '—'} />
            <InfoRow label="Status" value={customer.status} />
          </div>
        </TabsContent>
        <TabsContent value="accounts" className="mt-3 pb-4">
          {loadingA ? <LoadingRows rows={3} /> : accounts.length === 0 ? (
            <EmptyState message="No accounts for this customer." icon={Landmark} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium text-right">Principal</th>
                    <th className="px-3 py-2 font-medium text-right">Payable</th>
                    <th className="px-3 py-2 font-medium text-right">Paid</th>
                    <th className="px-3 py-2 font-medium text-right">Outstanding</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{a.accountNumber}</td>
                      <td className="px-3 py-2">{a.interestType}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(a.principal)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(a.totalPayable)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(a.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(a.outstanding)}</td>
                      <td className="px-3 py-2"><Badge className={cn(STATUS_COLORS[a.status])}>{a.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="payments" className="mt-3 pb-4">
          {loadingP ? <LoadingRows rows={3} /> : payments.length === 0 ? (
            <EmptyState message="No payment history yet." icon={HandCoins} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Receipt</th>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Collector</th>
                    <th className="px-3 py-2 font-medium text-right">Balance After</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{formatDate(p.collectionDate)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.receiptNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.accountNumber}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(p.amount)}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.paymentMode}</Badge></td>
                      <td className="px-3 py-2 text-xs">{p.collectedBy}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.balanceAfter)}</td>
                      <td className="px-3 py-2"><Badge className={cn(STATUS_COLORS[p.status])}>{p.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit customer dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Full Name"><Input value={editForm.fullName || ''} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} /></Field>
            <Field label="Primary Mobile"><Input value={editForm.primaryMobile || ''} onChange={(e) => setEditForm({ ...editForm, primaryMobile: e.target.value })} /></Field>
            <Field label="Alternate Mobile"><Input value={editForm.alternateMobile || ''} onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} /></Field>
            <Field label="Occupation"><Input value={editForm.occupation || ''} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} /></Field>
            <Field label="Address" full><Input value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
            <Field label="City"><Input value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></Field>
            <Field label="Area"><Input value={editForm.area || ''} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} /></Field>
            <Field label="Reference Name"><Input value={editForm.referenceName || ''} onChange={(e) => setEditForm({ ...editForm, referenceName: e.target.value })} /></Field>
            <Field label="Reference Mobile"><Input value={editForm.referenceMobile || ''} onChange={(e) => setEditForm({ ...editForm, referenceMobile: e.target.value })} /></Field>
            <Field label="KYC Type">
              <Select value={editForm.idType || 'Aadhaar'} onValueChange={(v) => setEditForm({ ...editForm, idType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                  <SelectItem value="PAN">PAN</SelectItem>
                  <SelectItem value="Voter ID">Voter ID</SelectItem>
                  <SelectItem value="Driving License">Driving License</SelectItem>
                  <SelectItem value="Passport">Passport</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="KYC Number" full><Input value={editForm.idNumber || ''} onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={editForm.status || 'ACTIVE'} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  )
}
function MiniStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  const tones = { default: '', success: 'text-emerald-600 dark:text-emerald-400', warning: 'text-amber-600 dark:text-amber-400' }
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', tones[tone])}>{value}</p>
    </div>
  )
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
