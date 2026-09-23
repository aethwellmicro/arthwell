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
  FileText,
  MoreVertical,
  Eye,
  FileSpreadsheet,
  Banknote,
  UsersRound,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Ban,
  Trash2,
  AlertTriangle,
  Share2,
  Download,
  Printer,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch, formatMoney, formatMoneyCompact, formatDate, STATUS_COLORS, ROLE_LABELS, downloadCSV } from '@/lib/format'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { SectionCard, EmptyState, LoadingRows, StatCard } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
import { SortableHeader, sortArray } from '@/components/sortable-header'
import { CustomerStatement } from '@/components/customer-statement'
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
  amount?: number | null
  branch: string
  status: string
  groupId?: string | null
  group?: { id: string; groupId: string; name: string; branch?: string } | null
  approvedById?: string | null
  approvedBy?: { id: string; name: string } | null
  approvedAt?: string | null
  rejectedById?: string | null
  rejectedBy?: { id: string; name: string } | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  cancelledById?: string | null
  cancelledBy?: { id: string; name: string } | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  createdAt: string
  createdBy?: { id?: string; name: string; role?: string }
  totalPayable: number
  totalCollected: number
  outstanding: number
  lastPaymentDate?: string | null
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
  processingFee?: number
  insurancePremium?: number
  totalFees?: number
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
  amount: '',
  groupId: '',
  branch: 'Main Branch',
}

interface GroupOption {
  id: string
  groupId: string
  name: string
  branch: string
  status: string
}

const emptyGroupForm = {
  name: '',
  branch: 'Main Branch',
  description: '',
  status: 'ACTIVE',
}

import { useRouter } from 'next/navigation'

export function CustomersView({ customerId }: { customerId?: string }) {
  const { user, searchQuery, setSearchQuery } = useApp()
  const router = useRouter()
  const [items, setItems] = useState<Customer[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [groupId, setGroupId] = useState('ALL')
  const [area, setArea] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [saving, setSaving] = useState(false)
  const [savingGroup, setSavingGroup] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)

  // Modals for actions
  const [rejectTarget, setRejectTarget] = useState<Customer | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [cancelTarget, setCancelTarget] = useState<Customer | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER'

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        setSortKey(null)
        setSortDir(null)
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const loadGroups = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: GroupOption[] }>('/api/groups?status=ACTIVE&limit=200')
      setGroups(data.items)
    } catch {
      // ignore
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status !== 'ALL') params.set('status', status)
      if (groupId !== 'ALL') params.set('groupId', groupId)
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
  }, [q, status, groupId, area])

  const sortedItems = useMemo(() => {
    if (sortKey && sortDir) {
      return sortArray(items, sortKey, sortDir)
    }
    return items
  }, [items, sortKey, sortDir])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, page, pageSize])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

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
    if (customerId) {
      apiFetch<Customer>(`/api/customers/${customerId}`).then(setSelected).catch(() => {})
    } else {
      setSelected(null)
    }
  }, [customerId])

  async function save() {
    if (!form.fullName.trim() || !form.primaryMobile.trim()) {
      toast.error('Name and primary mobile are required.')
      return
    }
    if (!form.groupId) {
      toast.error('Please select a group.')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/customers', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Customer registered and submitted for verification!')
      setForm(emptyForm)
      setShowNew(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required.')
      return
    }
    setSavingGroup(true)
    try {
      const created = await apiFetch<GroupOption>('/api/groups', {
        method: 'POST',
        body: JSON.stringify(groupForm),
      })
      toast.success('Group created successfully!')
      setGroupForm(emptyGroupForm)
      setShowNewGroup(false)
      await loadGroups()
      setForm((prev) => ({ ...prev, groupId: created.id }))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingGroup(false)
    }
  }

  async function handleApprove(targetCustomer: Customer) {
    try {
      await apiFetch(`/api/customers/${targetCustomer.id}/approve`, { method: 'POST' })
      toast.success(`Customer ${targetCustomer.fullName} has been APPROVED for disbursement!`)
      load()
      if (selected?.id === targetCustomer.id) {
        const full = await apiFetch<Customer>(`/api/customers/${targetCustomer.id}`)
        setSelected(full)
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.')
      return
    }
    setRejecting(true)
    try {
      await apiFetch(`/api/customers/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      })
      toast.success(`Customer ${rejectTarget.fullName} rejected.`)
      setRejectTarget(null)
      setRejectionReason('')
      load()
      if (selected?.id === rejectTarget.id) {
        const full = await apiFetch<Customer>(`/api/customers/${rejectTarget.id}`)
        setSelected(full)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRejecting(false)
    }
  }

  async function handleResubmit(targetCustomer: Customer) {
    try {
      await apiFetch(`/api/customers/${targetCustomer.id}/resubmit`, { method: 'POST' })
      toast.success(`Customer ${targetCustomer.fullName} resubmitted for verification!`)
      load()
      if (selected?.id === targetCustomer.id) {
        const full = await apiFetch<Customer>(`/api/customers/${targetCustomer.id}`)
        setSelected(full)
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    if (!cancellationReason.trim()) {
      toast.error('Cancellation reason is required.')
      return
    }
    setCancelling(true)
    try {
      await apiFetch(`/api/customers/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancellationReason }),
      })
      toast.success(`Customer ${cancelTarget.fullName} has been cancelled.`)
      setCancelTarget(null)
      setCancellationReason('')
      load()
      if (selected?.id === cancelTarget.id) {
        const full = await apiFetch<Customer>(`/api/customers/${cancelTarget.id}`)
        setSelected(full)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCancelling(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success(`Customer ${deleteTarget.fullName} deleted safely.`)
      setDeleteTarget(null)
      if (selected?.id === deleteTarget.id) setSelected(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  function handleOpenEdit(customerToEdit: Customer) {
    setSelected(customerToEdit)
  }

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3 flex-1">
          <div className="flex-1 min-w-[200px] relative">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, mobile, customer ID…"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[155px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="DISBURSED">Disbursed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="ACTIVE">Active (Legacy)</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="All Groups" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.groupId} - {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Area</Label>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Area"
              className="w-[140px]"
            />
          </div>
        </div>

        {/* Dual Actions: [ + New Group ] [ + New Customer ] side-by-side / wrap safely */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0">
          <Button
            variant="outline"
            onClick={() => setShowNewGroup(true)}
            className="flex-1 sm:flex-initial"
          >
            <UsersRound className="h-4 w-4 mr-1.5 text-primary" /> + New Group
          </Button>
          <Button
            onClick={() => setShowNew(true)}
            className="flex-1 sm:flex-initial"
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> + New Customer
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Customers</p>
            <p className="text-lg font-bold">{items.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">Pending Approval</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {items.filter((c) => c.status === 'PENDING_VERIFICATION').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-teal-600 dark:text-teal-400">Approved</p>
            <p className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {items.filter((c) => c.status === 'APPROVED' || c.status === 'READY_FOR_DISBURSEMENT').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Disbursed / Active</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {items.filter((c) => c.status === 'DISBURSED' || c.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
            <p className="text-lg font-bold text-primary">
              {formatMoneyCompact(items.reduce((s, c) => s + (c.outstanding || 0), 0))}
            </p>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedItems = items.filter((c) => selectedIds.has(c.id))
                downloadCSV(
                  `customers-${new Date().toISOString().slice(0, 10)}.csv`,
                  selectedItems.map((c) => ({
                    customerId: c.customerId,
                    name: c.fullName,
                    mobile: c.primaryMobile,
                    group: c.group ? `${c.group.groupId} - ${c.group.name}` : '',
                    branch: c.branch,
                    area: c.area || '',
                    outstanding: c.outstanding,
                    status: c.status,
                  }))
                )
                toast.success(`Exported ${selectedIds.size} customers`)
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Export Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedItems = items.filter((c) => selectedIds.has(c.id))
                selectedItems.forEach((c) => {
                  navigator.clipboard?.writeText(c.primaryMobile)
                })
                toast.success(`Copied ${selectedIds.size} mobile numbers`)
              }}
            >
              <Phone className="h-3.5 w-3.5 mr-1" /> Copy Mobiles
            </Button>
          </div>
        </div>
      )}

      <SectionCard
        title={`Customers (${items.length})`}
        action={
          (q || status !== 'ALL' || groupId !== 'ALL' || area) && !loading ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setStatus('ALL')
                setGroupId('ALL')
                setArea('')
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
            </Button>
          ) : undefined
        }
      >
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No customers found. Register your first customer." icon={Users} />
        ) : (
          <>
            {/* Mobile Card Layout (<md) */}
            <div className="md:hidden space-y-3 p-1">
              {paginatedItems.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  className={cn(
                    'rounded-lg border bg-card p-3.5 space-y-2.5 shadow-sm active:scale-[0.99] transition-transform cursor-pointer',
                    selectedIds.has(c.id) && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{c.customerId}</span>
                        <Badge className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-800')}>
                          {c.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm truncate mt-1 text-foreground" title={c.fullName}>
                        {c.fullName}
                      </p>
                      {c.group && (
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="font-semibold text-primary">{c.group.groupId}</span> — {c.group.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                      <p className="text-sm font-bold text-primary">
                        {c.outstanding > 0 ? formatMoney(c.outstanding) : '₹0.00'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 gap-2">
                    <span className="font-mono flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.primaryMobile}
                    </span>
                    <span>{c.branch || 'Main Branch'}</span>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                    {isManagerOrAdmin && c.status === 'PENDING_VERIFICATION' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-emerald-600 border-emerald-300 flex-1"
                          onClick={() => handleApprove(c)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-rose-600 border-rose-300 flex-1"
                          onClick={() => setRejectTarget(c)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}

                    {c.status === 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs text-amber-600 border-amber-300 flex-1"
                        onClick={() => handleResubmit(c)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resubmit
                      </Button>
                    )}

                    {c.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs flex-1"
                        onClick={() => router.push(`/accounts?customer=${c.id}`)}
                      >
                        <Landmark className="h-3.5 w-3.5 mr-1" /> Disburse
                      </Button>
                    )}

                    {(c.status === 'DISBURSED' || c.status === 'ACTIVE') && (
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs flex-1"
                        onClick={() => router.push(`/collections?customer=${c.id}`)}
                      >
                        <HandCoins className="h-3.5 w-3.5 mr-1" /> Collect
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSelected(c)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>

                    {(!c._count?.accounts || c._count.accounts === 0) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(c)}
                        title="Delete Customer"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout (hidden on mobile, visible md+) */}
            <div className="hidden md:block max-h-[58vh] overflow-y-auto scroll-area overflow-x-auto">
              <table className="w-full text-sm zebra-table min-w-[1080px]">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 w-10 whitespace-nowrap">
                      <Checkbox
                        checked={paginatedItems.length > 0 && paginatedItems.every((c) => selectedIds.has(c.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set([...selectedIds, ...paginatedItems.map((c) => c.id)]))
                          } else {
                            const next = new Set(selectedIds)
                            paginatedItems.forEach((c) => next.delete(c.id))
                            setSelectedIds(next)
                          }
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    <SortableHeader label="Customer ID" sortKey="customerId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Customer Name" sortKey="fullName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Mobile" sortKey="primaryMobile" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Group" sortKey="group.name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Branch" sortKey="branch" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Created By" sortKey="createdBy.name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Outstanding" sortKey="outstanding" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                    <th className="px-4 py-2.5 font-medium text-right text-xs text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className={cn('border-b last:border-0 hover:bg-muted/40 cursor-pointer', selectedIds.has(c.id) && 'bg-primary/5')}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds)
                            if (checked) next.add(c.id)
                            else next.delete(c.id)
                            setSelectedIds(next)
                          }}
                          aria-label={`Select ${c.fullName}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap font-medium text-primary">
                        {c.customerId}
                      </td>
                      <td className="px-3 py-2.5 min-w-[180px] max-w-[240px]">
                        <p className="font-medium truncate text-foreground" title={c.fullName}>
                          {c.fullName}
                        </p>
                        {c.area && <span className="text-[11px] text-muted-foreground block truncate">{c.area}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">{c.primaryMobile}</td>
                      <td className="px-3 py-2.5 min-w-[150px] max-w-[200px]">
                        {c.group ? (
                          <div className="truncate" title={`${c.group.groupId} — ${c.group.name}`}>
                            <span className="font-mono text-xs font-semibold text-primary mr-1">
                              {c.group.groupId}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{c.group.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No Group</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{c.branch || 'Main Branch'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge className={cn(STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-800 border-slate-200')}>
                          {c.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {c.createdBy?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                        {c.outstanding > 0 ? formatMoney(c.outstanding) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick inline approval for Branch Manager / Admin */}
                          {isManagerOrAdmin && c.status === 'PENDING_VERIFICATION' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                                onClick={() => handleApprove(c)}
                                title="Approve Customer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300"
                                onClick={() => setRejectTarget(c)}
                                title="Reject Customer"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}

                          {/* Quick resubmit for Field Officer if rejected */}
                          {c.status === 'REJECTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 border-amber-300"
                              onClick={() => handleResubmit(c)}
                              title="Resubmit for Verification"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resubmit
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Actions">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/customers/${c.id}`)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => handleOpenEdit(c)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Customer
                              </DropdownMenuItem>

                              {c.status === 'APPROVED' && (
                                <DropdownMenuItem onClick={() => router.push(`/accounts?customer=${c.id}`)}>
                                  <Landmark className="h-3.5 w-3.5 mr-2 text-primary" /> Disburse Loan
                                </DropdownMenuItem>
                              )}

                              {(c.status === 'DISBURSED' || c.status === 'ACTIVE') && (
                                <DropdownMenuItem onClick={() => router.push(`/collections?customer=${c.id}`)}>
                                  <HandCoins className="h-3.5 w-3.5 mr-2" /> New Collection
                                </DropdownMenuItem>
                              )}

                              {isManagerOrAdmin && c.status === 'PENDING_VERIFICATION' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleApprove(c)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRejectTarget(c)}>
                                    <XCircle className="h-3.5 w-3.5 mr-2 text-rose-600" /> Reject
                                  </DropdownMenuItem>
                                </>
                              )}

                              {c.status !== 'CANCELLED' && c.status !== 'DISBURSED' && (
                                <DropdownMenuItem onClick={() => setCancelTarget(c)} className="text-amber-600">
                                  <Ban className="h-3.5 w-3.5 mr-2" /> Cancel Request
                                </DropdownMenuItem>
                              )}

                              {(!c._count?.accounts || c._count.accounts === 0) && (
                                <DropdownMenuItem onClick={() => setDeleteTarget(c)} className="text-rose-600">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Customer
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(c.primaryMobile); toast.success('Mobile copied') }}>
                                <Phone className="h-3.5 w-3.5 mr-2" /> Copy Mobile
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              />
            )}
          </>
        )}
      </SectionCard>

      {/* Quick Create Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" /> Create New Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Group Name *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g. Shivaji Nagar Weekly Group"
              />
            </div>
            <div>
              <Label className="text-xs">Branch *</Label>
              <Input
                value={groupForm.branch}
                onChange={(e) => setGroupForm({ ...groupForm, branch: e.target.value })}
                placeholder="Main Branch"
              />
            </div>
            <div>
              <Label className="text-xs">Description (Optional)</Label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder="Meeting day, area description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>Cancel</Button>
            <Button onClick={saveGroup} disabled={savingGroup}>
              {savingGroup ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New customer dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Register New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Group Selection */}
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Assigned Group *</Label>
                <button
                  type="button"
                  onClick={() => setShowNewGroup(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Create Group
                </button>
              </div>
              <Select
                value={form.groupId}
                onValueChange={(v) => setForm({ ...form, groupId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select active group (Required)" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.groupId} — {g.name} ({g.branch})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                All customers must be assigned to an active group before loan verification.
              </p>
            </div>

            <Field label="Full Name *">
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Full Legal Name"
              />
            </Field>
            <Field label="Primary Mobile *">
              <Input
                value={form.primaryMobile}
                onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })}
                placeholder="10-digit mobile number"
              />
            </Field>
            <Field label="Amount (₹) *">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </Field>
            <Field label="Alternate Mobile">
              <Input
                value={form.alternateMobile}
                onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })}
              />
            </Field>
            <Field label="Occupation">
              <Input
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              />
            </Field>
            <Field label="Address" full>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="Area">
              <Input
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
              />
            </Field>
            <Field label="Reference Name">
              <Input
                value={form.referenceName}
                onChange={(e) => setForm({ ...form, referenceName: e.target.value })}
              />
            </Field>
            <Field label="Reference Mobile">
              <Input
                value={form.referenceMobile}
                onChange={(e) => setForm({ ...form, referenceMobile: e.target.value })}
              />
            </Field>
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
            <Field label="KYC Number" full>
              <Input
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Submit for Verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="h-5 w-5" /> Reject Customer Verification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Provide a clear reason why <strong>{rejectTarget?.fullName}</strong> ({rejectTarget?.customerId}) is being rejected. The Field Officer can correct and resubmit.
            </p>
            <div>
              <Label className="text-xs font-semibold">Rejection Reason *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Address proof missing or unreadable..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Modal */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Ban className="h-5 w-5" /> Cancel Customer Application
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Cancelling marks customer <strong>{cancelTarget?.fullName}</strong> as withdrawn while safely keeping audit history intact.
            </p>
            <div>
              <Label className="text-xs font-semibold">Cancellation Reason *</Label>
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g. Customer withdrew loan request..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Keep Active</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Safe Delete Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Delete Customer Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Hard delete is ONLY permitted if this customer has 0 loans, 0 collections, and no financial records.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete <strong>{deleteTarget?.fullName}</strong> ({deleteTarget?.customerId})?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer detail drawer */}
      <Drawer open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); router.push('/customers') } }}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {selected?.fullName}
              {selected && (
                <Badge className={cn(STATUS_COLORS[selected.status] || 'bg-slate-100 text-slate-800')}>
                  {selected.status.replace(/_/g, ' ')}
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>
          {selected && (
            <CustomerDetail
              customer={selected}
              groups={groups}
              isManagerOrAdmin={isManagerOrAdmin}
              onCollect={() => { router.push(`/collections?customer=${selected.id}`); setSelected(null) }}
              onUpdated={(c) => setSelected(c)}
              onApprove={() => handleApprove(selected)}
              onReject={() => setRejectTarget(selected)}
              onResubmit={() => handleResubmit(selected)}
              onCancel={() => setCancelTarget(selected)}
              onDelete={() => setDeleteTarget(selected)}
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

function CustomerDetail({
  customer,
  groups,
  isManagerOrAdmin,
  onCollect,
  onUpdated,
  onApprove,
  onReject,
  onResubmit,
  onCancel,
  onDelete,
}: {
  customer: Customer
  groups: GroupOption[]
  isManagerOrAdmin: boolean
  onCollect: () => void
  onUpdated: (c: Customer) => void
  onApprove: () => void
  onReject: () => void
  onResubmit: () => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const router = useRouter()
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
    setLoadingP(true)
    apiFetch<{ items: Payment[] }>(`/api/customers/${customer.id}/payments`).then((d) => setPayments(d.items)).finally(() => setLoadingP(false))
  }, [customer.id])

  const [sharingStatement, setSharingStatement] = useState(false)
  const [statementLink, setStatementLink] = useState('')

  function printStatement() {
    setTimeout(() => window.print(), 200)
  }

  async function shareStatement() {
    setSharingStatement(true)
    try {
      const res = await apiFetch<any>(`/api/customers/${customer.id}/statement/share`, { method: 'POST' })
      setStatementLink(res.shareUrl)
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.shareUrl)
        toast.success('Share link copied to clipboard! (Valid for 7 days)')
      } else {
        toast.success(`Share link generated: ${res.shareUrl}`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSharingStatement(false)
    }
  }

  async function downloadStatementCSV() {
    try {
      const data = await apiFetch<any>(`/api/customers/${customer.id}/statement`)
      if (data.ledgerEntries && data.ledgerEntries.length > 0) {
        const rows = data.ledgerEntries.map((l: any) => ({
          date: l.date,
          particulars: l.particulars,
          refNumber: l.receiptNumber || '—',
          accountNumber: l.accountNumber || data.account?.accountNumber || '—',
          debit_Dr: l.debit || 0,
          credit_Cr: l.credit || 0,
          paymentMode: l.paymentMode,
          staffChannel: l.collectedBy,
          balanceAfter: l.balanceAfter,
          status: l.status,
        }))
        downloadCSV(`statement-ledger-${customer.customerId}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
        toast.success('Account statement ledger (Dr/Cr) downloaded as CSV')
      } else if (data.transactions && data.transactions.length > 0) {
        const rows = data.transactions.map((p: any) => ({
          date: p.date,
          particulars: p.particulars || 'EMI Collection',
          receiptNumber: p.receiptNumber,
          accountNumber: data.account?.accountNumber || '—',
          debit_Dr: p.debit || 0,
          credit_Cr: p.credit || p.amount,
          amount: p.amount,
          paymentMode: p.paymentMode,
          previousOutstanding: p.previousOutstanding,
          currentOutstanding: p.currentOutstanding,
          status: p.status,
        }))
        downloadCSV(`statement-transactions-${customer.customerId}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
        toast.success('Transaction history downloaded as CSV')
      } else if (data.schedule && data.schedule.length > 0) {
        const rows = data.schedule.map((s: any) => ({
          week: s.installNo,
          dueDate: s.dueDate,
          emi: s.amount,
          principalPart: s.principalPart,
          interestPart: s.interestPart,
          savingsPart: s.savingsPart,
          paidAmount: s.paidAmount,
          paidSavings: s.paidSavings,
          balance: s.balance,
          status: s.status,
        }))
        downloadCSV(`loan-schedule-${customer.customerId}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
        toast.success('Repayment schedule downloaded as CSV')
      } else {
        toast.info('No statement transactions or schedule available for download.')
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

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
      amount: customer.amount != null ? String(customer.amount) : '',
      groupId: customer.groupId || '',
      branch: customer.branch || 'Main Branch',
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
      {/* Workflow Banner */}
      {customer.status === 'PENDING_VERIFICATION' && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>This customer is <strong>Pending Branch Manager Verification</strong>. Loan disbursement cannot proceed until approved.</span>
          </div>
          {isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApprove}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Customer
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-rose-600 hover:bg-rose-50 border-rose-300" onClick={onReject}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {customer.status === 'REJECTED' && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 text-xs text-rose-900 dark:text-rose-200">
            <p className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <XCircle className="h-4 w-4" /> Application Rejected by {customer.rejectedBy?.name || 'Branch Manager'}
            </p>
            <p>Reason: {customer.rejectionReason || 'No reason provided.'}</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50" onClick={onResubmit}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resubmit for Approval
          </Button>
        </div>
      )}

      {customer.status === 'APPROVED' && (
        <div className="bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-900 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 text-xs">
            <CheckCircle2 className="h-4 w-4 text-teal-600" />
            <span>Approved by <strong>{customer.approvedBy?.name || 'Branch Manager'}</strong>. Ready for Account / Loan Disbursement.</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-300" onClick={onCancel}>
            <Ban className="h-3.5 w-3.5 mr-1" /> Cancel Application
          </Button>
        </div>
      )}

      {customer.status === 'CANCELLED' && (
        <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-slate-800 dark:text-slate-200">Application Cancelled</p>
          <p>Reason: {customer.cancellationReason || 'Withdrawn by customer'}</p>
        </div>
      )}

      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/30">
        <DetailItem icon={Phone} label="Mobile" value={customer.primaryMobile} />
        <DetailItem icon={UsersRound} label="Group" value={customer.group ? `${customer.group.groupId} (${customer.group.name})` : '—'} />
        <DetailItem icon={MapPin} label="Branch & Area" value={`${customer.branch || 'Main Branch'} - ${customer.area || '—'}`} />
        <DetailItem icon={Banknote} label="Amount" value={customer.amount ? formatMoney(Number(customer.amount)) : '—'} />
      </div>
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b bg-muted/20">
        <MiniStat label="Total Payable" value={formatMoney(customer.totalPayable)} />
        <MiniStat label="Total Collected" value={formatMoney(customer.totalCollected)} tone="success" />
        <MiniStat label="Outstanding" value={formatMoney(customer.outstanding)} tone="warning" />
        <div className="flex items-end gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
          <Button size="sm" variant="outline" onClick={printStatement} title="Print Statement"><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
          <Button size="sm" variant="outline" onClick={shareStatement} disabled={sharingStatement} title="Generate Shareable Link"><Share2 className="h-3.5 w-3.5 mr-1" /> {sharingStatement ? 'Sharing…' : 'Share'}</Button>
          <Button size="sm" variant="outline" onClick={downloadStatementCSV} title="Download CSV"><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
          {(customer.status === 'DISBURSED' || customer.status === 'ACTIVE') && (
            <Button size="sm" onClick={onCollect}><HandCoins className="h-3.5 w-3.5 mr-1" /> Collect</Button>
          )}
          {accounts.length === 0 && customer.status !== 'DISBURSED' && onDelete && (
            <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300" onClick={onDelete} title="Delete Customer">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
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
            <InfoRow label="Group" value={customer.group ? `${customer.group.groupId} — ${customer.group.name}` : '—'} />
            <InfoRow label="Branch" value={customer.branch || 'Main Branch'} />
            <InfoRow label="Amount" value={customer.amount ? formatMoney(Number(customer.amount)) : '—'} />
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
              <table className="w-full text-sm zebra-table min-w-[650px]">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Account</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Type</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Principal</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Payable</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Paid</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Outstanding</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap font-semibold text-primary">{a.accountNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{a.interestType}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(a.principal)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(a.totalPayable)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatMoney(a.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(a.outstanding)}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><Badge className={cn(STATUS_COLORS[a.status])}>{a.status}</Badge></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => router.push(`/accounts/${a.id}`)}
                          title="View Schedule & Loan Details"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Schedule
                        </Button>
                      </td>
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
              <table className="w-full text-sm zebra-table min-w-[700px]">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Receipt</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Account</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Mode</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Collector</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Balance After</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.collectionDate)}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.receiptNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.accountNumber}</td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatMoney(p.amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><Badge variant="outline">{p.paymentMode}</Badge></td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{p.collectedBy}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(p.balanceAfter)}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><Badge className={cn(STATUS_COLORS[p.status])}>{p.status}</Badge></td>
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
            <Field label="Amount (₹)">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₹</span>
                <Input type="number" min="0" step="0.01" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} placeholder="0.00" className="pl-7" />
              </div>
            </Field>
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
            <Field label="Assigned Group">
              <Select value={editForm.groupId || ''} onValueChange={(v) => setEditForm({ ...editForm, groupId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.groupId} — {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Branch">
              <Input value={editForm.branch || 'Main Branch'} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })} />
            </Field>
            <Field label="KYC Number" full><Input value={editForm.idNumber || ''} onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={editForm.status || 'ACTIVE'} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="DISBURSED">Disbursed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
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

      {/* Print-only customer statement */}
      {(() => {
        const activeAcc = accounts.find((a) => a.status === 'ACTIVE') || accounts[0] || null
        const statementEntries: any[] = []

        if (activeAcc) {
          // 1. Disbursement: Debit side
          statementEntries.push({
            date: activeAcc.startDate,
            particulars: `Loan Sanction & Disbursement`,
            receiptNumber: activeAcc.accountNumber,
            accountNumber: activeAcc.accountNumber,
            debit: activeAcc.principal,
            credit: 0,
            side: 'DEBIT',
            paymentMode: 'DISBURSEMENT',
            collectedBy: customer.createdBy?.name || 'Branch Office',
            balanceAfter: activeAcc.principal,
            status: 'DISBURSED',
          })

          // 2. Upfront Recovered / Deducted Charges: CREDIT side
          const procFee = Number(activeAcc.processingFee || 0)
          const insPrem = Number(activeAcc.insurancePremium || 0)
          const totalCharges = procFee + insPrem

          if (totalCharges > 0) {
            statementEntries.push({
              date: activeAcc.startDate,
              particulars: `Recovered Charges (Proc: ₹${procFee} + Ins: ₹${insPrem})`,
              receiptNumber: 'CHG-' + activeAcc.accountNumber.slice(-4),
              accountNumber: activeAcc.accountNumber,
              debit: 0,
              credit: totalCharges,
              side: 'CREDIT',
              paymentMode: 'DEDUCTION',
              collectedBy: 'Auto Deduction',
              balanceAfter: activeAcc.principal,
              status: 'RECOVERED',
            })
          }
        }

        // 3. Collection payments: CREDIT side
        for (const p of payments) {
          statementEntries.push({
            date: p.collectionDate,
            particulars: 'EMI Repayment Received',
            receiptNumber: p.receiptNumber,
            accountNumber: p.accountNumber,
            debit: 0,
            credit: p.amount,
            side: 'CREDIT',
            paymentMode: p.paymentMode,
            collectedBy: p.collectedBy,
            balanceAfter: p.balanceAfter,
            status: p.status,
          })
        }

        return (
          <CustomerStatement
            customer={customer}
            account={
              activeAcc
                ? {
                    accountNumber: activeAcc.accountNumber,
                    principal: activeAcc.principal,
                    processingFee: activeAcc.processingFee,
                    insurancePremium: activeAcc.insurancePremium,
                    totalFees: (activeAcc.processingFee || 0) + (activeAcc.insurancePremium || 0),
                  }
                : null
            }
            totalPayable={customer.totalPayable}
            totalCollected={customer.totalCollected}
            outstanding={customer.outstanding}
            entries={statementEntries}
            branchName={customer.branch || 'Main Branch - MG Road'}
          />
        )
      })()}
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
