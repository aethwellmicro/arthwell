'use client'

import { useEffect, useState } from 'react'
import { UserCog, Plus, Pencil, ShieldCheck, Mail, Phone, BadgeCheck } from 'lucide-react'
import { apiFetch, formatMoney, formatDate, ROLE_LABELS, ROLE_COLORS } from '@/lib/format'
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage employee accounts, roles and access.</p>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Employee</Button>
      </div>

      <SectionCard title={`Employees (${items.length})`}>
        {loading ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState message="No employees yet." icon={UserCog} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium text-right">Today</th>
                  <th className="px-3 py-2.5 font-medium text-right">Week</th>
                  <th className="px-3 py-2.5 font-medium text-right">Total</th>
                  <th className="px-3 py-2.5 font-medium text-center">Txns</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {e.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-muted-foreground">{e.employeeCode || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Badge className={cn(ROLE_COLORS[e.role])}>{ROLE_LABELS[e.role]}</Badge></td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> {e.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {e.phone || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(e.todayCollected)}</td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(e.weekCollected)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(e.totalCollected)}</td>
                    <td className="px-3 py-2.5 text-center">{e.transactionCount}</td>
                    <td className="px-3 py-2.5">
                      {e.active ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditTarget(e); setEditForm({ name: e.name, phone: e.phone || '', employeeCode: e.employeeCode || '', role: e.role, active: e.active, password: '' }) }}><Pencil className="h-3.5 w-3.5" /></Button>
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
