'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  GitBranch,
  Plus,
  Pencil,
  MapPin,
  Phone,
  Mail,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { apiFetch, formatMoney, formatMoneyCompact, formatDate } from '@/lib/format'
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
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Branch {
  id: string
  branchCode: string
  name: string
  city: string | null
  state: string | null
  address: string | null
  phone: string | null
  email: string | null
  status: string
  createdAt: string
  manager: { id: string; name: string; email: string; phone: string | null } | null
  _count: {
    users: number
    groups: number
    customers: number
    accounts: number
    collections: number
    investments: number
    expenses: number
  }
}

interface BranchDetail {
  branch: Branch & {
    users: { id: string; name: string; email: string; role: string; phone: string | null; active: boolean }[]
  }
  financials: {
    totalCollected: number
    totalDisbursed: number
    totalReceivable: number
    totalInvestments: number
    totalExpenses: number
  }
}

interface Employee {
  id: string
  name: string
  email: string
  role: string
}

const emptyForm = {
  name: '',
  branchCode: '',
  city: '',
  state: 'Maharashtra',
  address: '',
  phone: '',
  email: '',
  managerId: '',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INACTIVE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
      <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-base font-bold truncate">{value}</p>
      </div>
    </div>
  )
}

function BranchDetailPanel({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<BranchDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await apiFetch<BranchDetail>(`/api/branches/${branchId}`)
        if (!cancelled) setDetail(data)
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [branchId])

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <LoadingRows rows={5} />
      </div>
    )
  }

  if (!detail) return null

  const { branch, financials } = detail
  const netCash = financials.totalCollected + financials.totalInvestments - financials.totalExpenses

  return (
    <div className="space-y-5 py-2">
      {/* Address */}
      {(branch.city || branch.address) && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{[branch.address, branch.city, branch.state].filter(Boolean).join(', ')}</span>
        </div>
      )}

      {/* Financial Summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Financial Summary</p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Collected" value={formatMoneyCompact(financials.totalCollected)} icon={TrendingUp} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
          <StatCard label="Total Disbursed" value={formatMoneyCompact(financials.totalDisbursed)} icon={TrendingDown} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard label="Investments" value={formatMoneyCompact(financials.totalInvestments)} icon={TrendingUp} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
          <StatCard label="Expenses" value={formatMoneyCompact(financials.totalExpenses)} icon={TrendingDown} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        </div>
        <div className={cn('mt-2 rounded-lg border p-3 text-center', netCash >= 0 ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-200 bg-red-50 dark:bg-red-950/40')}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net Cash Position</p>
          <p className={cn('text-xl font-bold', netCash >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {formatMoney(netCash)}
          </p>
        </div>
      </div>

      {/* Record Counts */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Records</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Customers', val: branch._count.customers },
            { label: 'Accounts', val: branch._count.accounts },
            { label: 'Collections', val: branch._count.collections },
            { label: 'Investments', val: branch._count.investments },
            { label: 'Expenses', val: branch._count.expenses },
            { label: 'Users', val: branch._count.users },
          ].map((r) => (
            <div key={r.label} className="rounded-md border bg-muted/40 p-2">
              <p className="text-base font-bold">{r.val}</p>
              <p className="text-[10px] text-muted-foreground">{r.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned Users */}
      {detail.branch.users.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assigned Users ({detail.branch.users.length})</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-area">
            {detail.branch.users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {u.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.role.replace(/_/g, ' ')}</p>
                </div>
                {u.active ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function BranchesView() {
  const { user } = useApp()
  const isAdmin = user?.role === 'ADMIN'

  const [items, setItems] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Dialog state
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Branch | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Employees list for manager selection
  const [employees, setEmployees] = useState<Employee[]>([])

  async function handleDeleteBranch() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/branches/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success(`Branch ${deleteTarget.name} deleted successfully.`)
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete branch')
    } finally {
      setDeleting(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search) params.set('q', search)
      const data = await apiFetch<{ items: Branch[] }>(`/api/branches?${params}`)
      setItems(data.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  useEffect(() => {
    if (!isAdmin) return
    apiFetch<{ items: Employee[] }>('/api/employees')
      .then((d) => setEmployees(d.items))
      .catch(() => {})
  }, [isAdmin])

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      b.branchCode.toLowerCase().includes(q) ||
      (b.city || '').toLowerCase().includes(q)
    )
  }, [items, search])

  async function save() {
    if (!form.name.trim()) return toast.error('Branch name is required.')
    setSaving(true)
    try {
      await apiFetch('/api/branches', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          managerId: form.managerId || null,
        }),
      })
      toast.success('Branch created successfully')
      setForm(emptyForm)
      setShowNew(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!editTarget) return
    try {
      await apiFetch(`/api/branches/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          city: editForm.city,
          state: editForm.state,
          address: editForm.address,
          phone: editForm.phone,
          email: editForm.email,
          status: editForm.status,
          managerId: editForm.managerId || null,
        }),
      })
      toast.success('Branch updated')
      setEditTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {/* Non-admin: show their branch info */}
        <div className="rounded-lg border bg-muted/40 p-6 text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-2" />
          <p className="font-semibold text-sm">Branch: {user?.branch?.name || 'Unassigned'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.branchId ? 'You have access only to your assigned branch data.' : 'You are not assigned to any branch. Contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search by name, code, city…"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> New Branch
        </Button>
      </div>

      {/* Summary cards */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Branches</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {items.filter((b) => b.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Users</p>
            <p className="text-lg font-bold text-primary">
              {items.reduce((s, b) => s + b._count.users, 0)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Customers</p>
            <p className="text-lg font-bold">
              {items.reduce((s, b) => s + b._count.customers, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Branch Cards List */}
      <SectionCard title={`Branches (${filtered.length})`}>
        {loading ? (
          <LoadingRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No branches found." icon={Building2} />
        ) : (
          <div className="divide-y">
            {filtered.map((branch) => {
              const expanded = expandedId === branch.id
              return (
                <div key={branch.id} className="py-3 px-1">
                  {/* Branch Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <GitBranch className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{branch.name}</p>
                        <Badge variant="outline" className="text-[10px] font-mono">{branch.branchCode}</Badge>
                        <Badge className={cn('text-[10px]', STATUS_COLORS[branch.status] || 'bg-muted text-muted-foreground')}>
                          {branch.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {branch.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {branch.city}{branch.state ? `, ${branch.state}` : ''}
                          </span>
                        )}
                        {branch.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {branch.phone}
                          </span>
                        )}
                        {branch.manager && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Manager: {branch.manager.name}
                          </span>
                        )}
                      </div>
                      {/* Quick counts */}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        <span>{branch._count.users} users</span>
                        <span>·</span>
                        <span>{branch._count.customers} customers</span>
                        <span>·</span>
                        <span>{branch._count.accounts} accounts</span>
                        <span>·</span>
                        <span>{branch._count.collections} collections</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditTarget(branch)
                          setEditForm({
                            name: branch.name,
                            city: branch.city || '',
                            state: branch.state || '',
                            address: branch.address || '',
                            phone: branch.phone || '',
                            email: branch.email || '',
                            status: branch.status,
                            managerId: branch.manager?.id || '',
                          })
                        }}
                        aria-label="Edit branch"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(branch)}
                        title="Delete branch"
                        aria-label="Delete branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setExpandedId(expanded ? null : branch.id)}
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {expanded && (
                    <div className="mt-3 ml-13 pl-2 border-l-2 border-primary/20">
                      <BranchDetailPanel branchId={branch.id} onClose={() => setExpandedId(null)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* New Branch Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" /> New Branch
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pune Main Branch"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch Code (auto if blank)</Label>
              <Input
                value={form.branchCode}
                onChange={(e) => setForm({ ...form, branchCode: e.target.value.toUpperCase() })}
                placeholder="BR-0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Pune" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Maharashtra" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {employees.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch Manager (optional)</Label>
                <Select value={form.managerId || 'NONE'} onValueChange={(v) => setForm({ ...form, managerId: v === 'NONE' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select manager…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">— No Manager —</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.role.replace(/_/g, ' ')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Branch'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Branch — {editTarget?.branchCode}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch Name *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              {employees.length > 0 && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Branch Manager</Label>
                  <Select value={editForm.managerId || 'NONE'} onValueChange={(v) => setEditForm({ ...editForm, managerId: v === 'NONE' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">— No Manager —</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.role.replace(/_/g, ' ')})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Delete Branch
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-foreground">
            <p>
              Are you sure you want to delete branch <strong className="font-semibold text-rose-600">{deleteTarget?.name}</strong> ({deleteTarget?.branchCode})?
            </p>
            {deleteTarget && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">City:</span>
                  <span className="text-foreground">{deleteTarget.city || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Users:</span>
                  <span className="text-foreground">{deleteTarget._count.users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Customers:</span>
                  <span className="text-foreground">{deleteTarget._count.customers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked Accounts:</span>
                  <span className="text-foreground">{deleteTarget._count.accounts}</span>
                </div>
              </div>
            )}
            <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200">
              <p className="font-semibold flex items-center gap-1 mb-0.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Deletion Guard:
              </p>
              <p>
                Branches with active customers, accounts, or collections cannot be deleted. You must reassign or close all records first.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBranch} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
