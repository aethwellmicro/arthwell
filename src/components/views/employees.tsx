'use client'

import { useEffect, useState, useMemo } from 'react'
import { UserCog, Plus, Pencil, ShieldCheck, Mail, Phone, BadgeCheck, Search } from 'lucide-react'
import { apiFetch, formatMoney, formatMoneyCompact, formatDate, ROLE_LABELS, ROLE_COLORS } from '@/lib/format'
import { useApp, canManageUsers } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { SortableHeader, sortArray } from '@/components/sortable-header'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  email: string
  name: string
  role: string
  employeeCode?: string | null
  phone?: string | null
  active: boolean
  createdAt: string
  totalCollected: number
  transactionCount: number
  todayCollected: number
  weekCollected: number
}

const emptyForm = { name: '', email: '', password: '', role: 'COLLECTION_EMPLOYEE', employeeCode: '', phone: '' }

export function EmployeesView() {
  const { user } = useApp()
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const canManage = canManageUsers(user?.role)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ items: Employee[] }>('/api/employees')
      setItems(data.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter((e) => {
    if (roleFilter !== 'ALL' && e.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.employeeCode || '').toLowerCase().includes(q) || (e.phone || '').includes(search)
    }
    return true
  })

  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedFilteredItems = useMemo(() => {
    if (sortKey && sortDir) return sortArray(filteredItems, sortKey, sortDir)
    return filteredItems
  }, [filteredItems, sortKey, sortDir])

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!form.name || !form.email || !form.password) return toast.error('Name, email and password required.')
    setSaving(true)
    try {
      await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Employee created')
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
      const body: any = { name: editForm.name, phone: editForm.phone, employeeCode: editForm.employeeCode }
      if (editForm.password) body.password = editForm.password
      if (canManage && editForm.role !== undefined) body.role = editForm.role
      if (canManage && editForm.active !== undefined) body.active = editForm.active
      await apiFetch(`/api/employees/${editTarget.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      toast.success('Employee updated')
      setEditTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (!canManage) {
    return <EmptyState message="You do not have access to manage employees." icon={ShieldCheck} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, code, phone…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
              <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
              <SelectItem value="COLLECTION_EMPLOYEE">Collection Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)} className="ml-auto"><Plus className="h-4 w-4 mr-1" /> New Employee</Button>
      </div>

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Employees</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{items.filter((e) => e.active).length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collectors</p>
            <p className="text-lg font-bold text-primary">{items.filter((e) => e.role === 'COLLECTION_EMPLOYEE').length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Collected</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoneyCompact(items.reduce((s, e) => s + e.totalCollected, 0))}</p>
          </div>
        </div>
      )}

      <SectionCard title={`Employees (${sortedFilteredItems.length})`}>
        {loading ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState message="No employees yet." icon={UserCog} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area overflow-x-auto">
            <table className="w-full text-sm zebra-table min-w-[850px]">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <SortableHeader label="Employee" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Role" sortKey="role" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 font-medium text-left text-xs text-muted-foreground whitespace-nowrap">Contact</th>
                  <SortableHeader label="Today" sortKey="todayCollected" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Week" sortKey="weekCollected" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Total" sortKey="totalCollected" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader label="Txns" sortKey="transactionCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader label="Status" sortKey="active" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 font-medium text-right text-xs text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredItems.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          {e.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={e.name}>{e.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{e.employeeCode || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><Badge className={cn(ROLE_COLORS[e.role])}>{ROLE_LABELS[e.role]}</Badge></td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="text-xs flex items-center gap-1 truncate" title={e.email}><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{e.email}</span></p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap"><Phone className="h-3 w-3 shrink-0" /> {e.phone || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{e.todayCollected > 0 ? formatMoney(e.todayCollected) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{e.weekCollected > 0 ? formatMoney(e.weekCollected) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{e.totalCollected > 0 ? formatMoney(e.totalCollected) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{e.transactionCount}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {e.active ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditTarget(e); setEditForm({ name: e.name, phone: e.phone || '', employeeCode: e.employeeCode || '', role: e.role, active: e.active, password: '' }) }} aria-label="Edit employee"><Pencil className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* New employee dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" /> New Employee</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5"><Label className="text-xs text-muted-foreground">Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Employee Code</Label><Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="EMP-005" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                  <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                  <SelectItem value="COLLECTION_EMPLOYEE">Collection Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Employee'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit employee dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Edit Employee</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs text-muted-foreground">Full Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Employee Code</Label><Input value={editForm.employeeCode} onChange={(e) => setEditForm({ ...editForm, employeeCode: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs text-muted-foreground">New Password (leave blank to keep)</Label><Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></div>
              {canManage && (
                <>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Role</Label>
                    <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                        <SelectItem value="COLLECTION_EMPLOYEE">Collection Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Active</Label>
                    <Switch checked={editForm.active} onCheckedChange={(v) => setEditForm({ ...editForm, active: v })} />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
