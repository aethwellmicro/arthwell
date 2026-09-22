'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  UsersRound,
  Plus,
  Search,
  Building2,
  Calendar,
  User,
  Users,
  Eye,
  Pencil,
  Trash2,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import { apiFetch, formatDate, STATUS_COLORS, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { Pagination } from '@/components/pagination'
import { SortableHeader, sortArray } from '@/components/sortable-header'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Group {
  id: string
  groupId: string
  name: string
  branch: string
  description?: string | null
  status: string
  createdAt: string
  updatedAt: string
  createdById: string
  createdBy?: { id: string; name: string; role: string; email: string }
  _count?: { customers: number }
  customers?: any[]
}

const emptyGroupForm = {
  name: '',
  branch: 'Main Branch',
  description: '',
  status: 'ACTIVE',
}

export function GroupsView() {
  const { user } = useApp()
  const [items, setItems] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('ALL')
  const [branch, setBranch] = useState<string>('ALL')

  // Pagination & Sorting
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // New Group Dialog
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyGroupForm)
  const [saving, setSaving] = useState(false)

  // View / Detail Drawer
  const [selected, setSelected] = useState<Group | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [editForm, setEditForm] = useState(emptyGroupForm)
  const [updating, setUpdating] = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status !== 'ALL') params.set('status', status)
      if (branch !== 'ALL') params.set('branch', branch)
      params.set('limit', '200')
      const res = await apiFetch<{ items: Group[] }>(`/api/groups?${params}`)
      setItems(res.items)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [q, status, branch])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  async function handleCreateGroup() {
    if (!form.name.trim()) {
      toast.error('Group name is required.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success('Group created successfully!')
      setForm(emptyGroupForm)
      setShowNew(false)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create group')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(g: Group) {
    setSelected(g)
    setLoadingDetail(true)
    try {
      const full = await apiFetch<Group>(`/api/groups/${g.id}`)
      setSelected(full)
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch group details')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleUpdateGroup() {
    if (!editTarget) return
    if (!editForm.name.trim()) {
      toast.error('Group name is required.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/groups/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      toast.success('Group updated successfully')
      setEditTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update group')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteGroup() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/groups/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('Group deleted')
      setDeleteTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete group')
    } finally {
      setDeleting(false)
    }
  }

  function handleExport() {
    if (!items.length) {
      toast.error('No groups to export')
      return
    }
    downloadCSV(
      `groups-${new Date().toISOString().slice(0, 10)}.csv`,
      items.map((g) => ({
        'Group ID': g.groupId,
        'Group Name': g.name,
        Branch: g.branch,
        Status: g.status,
        'Customer Count': g._count?.customers ?? 0,
        'Created By': g.createdBy?.name || '—',
        'Created Date': formatDate(g.createdAt),
      }))
    )
    toast.success('Groups exported')
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedItems = useMemo(() => {
    if (sortKey && sortDir) return sortArray(items, sortKey, sortDir)
    return items
  }, [items, sortKey, sortDir])

  const paginatedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search Groups</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by group ID, name, or branch…"
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Branch</Label>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Branches</SelectItem>
              <SelectItem value="Main Branch">Main Branch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Group
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Groups</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active Groups</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {items.filter((g) => g.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inactive / Closed</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {items.filter((g) => g.status !== 'ACTIVE').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Members</p>
            <p className="text-lg font-bold text-primary">
              {items.reduce((acc, g) => acc + (g._count?.customers ?? 0), 0)}
            </p>
          </div>
        </div>
      )}

      {/* Groups Table */}
      <SectionCard title={`Groups (${items.length})`}>
        {loading ? (
          <LoadingRows rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            message={q || status !== 'ALL' ? 'Try adjusting your search filters.' : 'No groups found. Create your first group to start adding customers.'}
          />
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-sm zebra-table min-w-[850px]">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-left text-xs text-muted-foreground">
                    <SortableHeader label="Group ID" sortKey="groupId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Group Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Branch" sortKey="branch" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Customers" sortKey="_count.customers" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
                    <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Created By" sortKey="createdBy.name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Created Date" sortKey="createdAt" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2.5 font-medium text-right text-xs text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => openDetail(g)}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap font-medium text-primary">
                        {g.groupId}
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px]">
                        <p className="font-medium truncate" title={g.name}>{g.name}</p>
                        {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {g.branch}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap font-semibold">
                        <Badge variant="outline" className="px-2 py-0.5">
                          {g._count?.customers ?? 0}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge className={cn(STATUS_COLORS[g.status])}>{g.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {g.createdBy?.name || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(g.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="View Details"
                            onClick={() => openDetail(g)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Edit Group"
                            onClick={() => {
                              setEditTarget(g)
                              setEditForm({
                                name: g.name,
                                branch: g.branch,
                                description: g.description || '',
                                status: g.status,
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title="Delete Group"
                            onClick={() => setDeleteTarget(g)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                onPageSizeChange={(s) => {
                  setPageSize(s)
                  setPage(1)
                }}
              />
            )}
          </>
        )}
      </SectionCard>

      {/* New Group Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" /> Create New Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Group Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Shivaji Nagar Weekly Group"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch *</Label>
                <Input
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder="Branch Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description (Optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details about area, weekly schedule, or leader…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={saving}>
              {saving ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-lg max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Group ({editTarget?.groupId})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Group Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Branch</Label>
                <Input
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdateGroup} disabled={updating}>
              {updating ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-md max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              Are you sure you want to delete group{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> (
              <span className="font-mono font-semibold">{deleteTarget?.groupId}</span>)?
            </p>
            {(deleteTarget?._count?.customers ?? 0) > 0 ? (
              <p className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded-md border border-destructive/20">
                ⚠️ This group currently has {deleteTarget?._count?.customers} assigned customers.
                You cannot delete a group with assigned customers. Please reassign or remove them first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                This group has 0 customers and can be safely deleted.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleting || (deleteTarget?._count?.customers ?? 0) > 0}
            >
              {deleting ? 'Deleting…' : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Detail Drawer */}
      <Drawer open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                <span>{selected?.name}</span>
                <span className="font-mono text-sm text-muted-foreground font-normal">({selected?.groupId})</span>
                {selected && <Badge className={cn(STATUS_COLORS[selected.status])}>{selected.status}</Badge>}
              </div>
            </DrawerTitle>
          </DrawerHeader>

          {selected && (
            <div className="flex flex-col overflow-y-auto">
              {/* Group Overview Stats */}
              <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/30 text-sm">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Branch</p>
                  <p className="font-medium">{selected.branch}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Created By</p>
                  <p className="font-medium">{selected.createdBy?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Created Date</p>
                  <p className="font-medium">{formatDate(selected.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Total Customers</p>
                  <p className="font-bold text-primary">{selected.customers?.length ?? selected._count?.customers ?? 0}</p>
                </div>
              </div>

              {selected.description && (
                <div className="px-4 py-2.5 border-b bg-muted/10 text-xs">
                  <span className="font-semibold text-muted-foreground mr-1">Description:</span>
                  {selected.description}
                </div>
              )}

              {/* Customers in this Group */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" /> Customers in this Group
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {selected.customers?.length ?? 0} members
                  </span>
                </div>

                {loadingDetail ? (
                  <LoadingRows rows={3} />
                ) : !selected.customers || selected.customers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg bg-muted/20">
                    No customers have been assigned to this group yet.
                  </div>
                ) : (
                  <div className="border rounded-md overflow-x-auto scroll-area max-h-72">
                    <table className="w-full text-xs min-w-[650px]">
                      <thead className="bg-muted/60 sticky top-0 border-b">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Customer ID</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Mobile</th>
                          <th className="px-3 py-2 font-medium">Field Officer</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium text-center">Accounts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.customers.map((c: any) => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono font-medium">{c.customerId}</td>
                            <td className="px-3 py-2 font-medium truncate max-w-[180px]" title={c.fullName}>
                              {c.fullName}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{c.primaryMobile}</td>
                            <td className="px-3 py-2 text-muted-foreground">{c.createdBy?.name || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge className={cn(STATUS_COLORS[c.status])}>{c.status}</Badge>
                            </td>
                            <td className="px-3 py-2 text-center font-medium">
                              {c.accounts?.length ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
