'use client'

import { useEffect, useState, useMemo } from 'react'
import { UserCog, Plus, Pencil, ShieldCheck, Mail, Phone, BadgeCheck, Search, Trash2, AlertTriangle } from 'lucide-react'
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

interface BranchOption {
  id: string
  name: string
  branchCode: string
}

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
  branchId?: string | null
  branch?: {
    id: string
    name: string
    branchCode: string
  } | null
}

const emptyForm = { name: '', email: '', password: '', role: 'COLLECTION_EMPLOYEE', employeeCode: '', phone: '', branchId: '' }

export function EmployeesView() {
  const { user } = useApp()
  const [items, setItems] = useState<Employee[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteEmployee() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiFetch<any>(`/api/employees/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.deactivated) {
        toast.info(res.message || 'Employee was deactivated because linked financial records exist.')
      } else {
        toast.success(`Employee ${deleteTarget.name} deleted successfully.`)
      }
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete employee')
    } finally {
      setDeleting(false)
    }
  }

  const canManage = canManageUsers(user?.role)
  const isAdmin = user?.role === 'ADMIN'

  const load = async () => {
    setLoading(true)
    try {
      const [empData, branchData] = await Promise.all([
        apiFetch<{ items: Employee[] }>('/api/employees'),
        apiFetch<{ items: BranchOption[] }>('/api/branches').catch(() => ({ items: [] })),
      ])
      setItems(empData.items)
      if (branchData?.items) setBranches(branchData.items)
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
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        employeeCode: form.employeeCode?.trim() || null,
        phone: form.phone?.trim() || null,
      }
      if (isAdmin && form.branchId) {
        payload.branchId = form.branchId === 'NONE' ? null : form.branchId
      }
      await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify(payload) })
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
      if (isAdmin && editForm.branchId !== undefined) {
        body.branchId = editForm.branchId === 'NONE' ? null : editForm.branchId
      }
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
                  <th className="px-3 py-2.5 font-medium text-left text-xs text-muted-foreground whitespace-nowrap">Branch</th>
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
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs font-medium text-foreground">{e.branch?.name || <span className="text-muted-foreground">—</span>}</span>
                    </td>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditTarget(e)
                            setEditForm({
                              name: e.name,
                              phone: e.phone || '',
                              employeeCode: e.employeeCode || '',
                              role: e.role,
                              active: e.active,
                              branchId: e.branchId || 'NONE',
                              password: '',
                            })
                          }}
                          aria-label="Edit employee"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && user?.id !== e.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setDeleteTarget(e)}
                            title="Delete employee"
                            aria-label="Delete employee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
            <div className={isAdmin ? "space-y-1.5" : "col-span-2 space-y-1.5"}><Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="ADMIN">Admin</SelectItem>}
                  <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                  <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                  <SelectItem value="COLLECTION_EMPLOYEE">Collection Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Branch</Label>
                <Select value={form.branchId || 'NONE'} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Head Office / No Branch</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.branchCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                        {isAdmin && <SelectItem value="ADMIN">Admin</SelectItem>}
                        <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                        <SelectItem value="COLLECTION_EMPLOYEE">Collection Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin ? (
                    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Branch</Label>
                      <Select value={editForm.branchId || 'NONE'} onValueChange={(v) => setEditForm({ ...editForm, branchId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Head Office / No Branch</SelectItem>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.branchCode})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="space-y-1.5 flex items-center gap-2 pt-2">
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

      {/* Delete Employee Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Delete Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-foreground">
            <p>
              Are you sure you want to delete employee <strong className="font-semibold text-rose-600">{deleteTarget?.name}</strong> ({deleteTarget?.email})?
            </p>
            {deleteTarget && (
              <div className="bg-muted/50 p-3 rounded-md space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="text-foreground">{ROLE_LABELS[deleteTarget.role]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code:</span>
                  <span className="text-foreground">{deleteTarget.employeeCode || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transactions:</span>
                  <span className="text-foreground">{deleteTarget.transactionCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Collected:</span>
                  <span className="text-foreground font-semibold">{formatMoney(deleteTarget.totalCollected)}</span>
                </div>
              </div>
            )}
            <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1 mb-0.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Safety & Audit Preservation:
              </p>
              <p>
                If this employee has recorded collections or created accounts, their account will be safely deactivated to preserve financial audits.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEmployee} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
