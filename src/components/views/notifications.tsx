'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  Plus,
  Send,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  PartyPopper,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'
import { apiFetch, formatDateTime, formatMoney, formatRelativeTime, STATUS_COLORS, downloadCSV } from '@/lib/format'
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
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  message: string
  recipient: string
  status: string
  createdAt: string
  collection?: { receiptNumber: string; amount: number } | null
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; border: string }> = {
  PAYMENT_CONFIRMATION: { label: 'Payment Confirmation', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-l-emerald-500' },
  DUE_REMINDER: { label: 'Due Reminder', icon: CalendarClock, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300', border: 'border-l-amber-500' },
  OVERDUE_REMINDER: { label: 'Overdue Reminder', icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300', border: 'border-l-red-500' },
  ACCOUNT_COMPLETION: { label: 'Account Completion', icon: PartyPopper, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300', border: 'border-l-teal-500' },
}

const STATUS_BORDER: Record<string, string> = {
  SENT: 'border-l-emerald-500',
  PENDING: 'border-l-amber-500',
  FAILED: 'border-l-red-500',
}

export function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ type: 'DUE_REMINDER', recipient: '', message: '' })
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      params.set('limit', '500')
      const data = await apiFetch<{ items: Notification[] }>(`/api/notifications?${params}`)
      let filtered = data.items
      // client-side date + search filter (API doesn't support these)
      if (from) {
        const fd = new Date(from)
        filtered = filtered.filter((n) => new Date(n.createdAt) >= fd)
      }
      if (to) {
        const td = new Date(to + 'T23:59:59')
        filtered = filtered.filter((n) => new Date(n.createdAt) <= td)
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter((n) =>
          n.message.toLowerCase().includes(q) ||
          n.recipient.toLowerCase().includes(q) ||
          (n.collection?.receiptNumber || '').toLowerCase().includes(q)
        )
      }
      setItems(filtered)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, from, to, search])

  useEffect(() => {
    load()
  }, [load])

  async function send() {
    if (!form.recipient || !form.message) return toast.error('Recipient and message required.')
    try {
      await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Notification sent')
      setForm({ type: 'DUE_REMINDER', recipient: '', message: '' })
      setShowNew(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  function exportCSV() {
    if (!items.length) return toast.info('No notifications to export')
    downloadCSV(`notifications-${new Date().toISOString().slice(0, 10)}.csv`, items.map((n) => ({
      type: n.type,
      status: n.status,
      recipient: n.recipient,
      message: n.message,
      receipt: n.collection?.receiptNumber || '',
      amount: n.collection?.amount || '',
      createdAt: formatDateTime(n.createdAt),
    })))
    toast.success('Exported to CSV')
  }

  // Stats
  const stats = {
    total: items.length,
    sent: items.filter((n) => n.status === 'SENT').length,
    pending: items.filter((n) => n.status === 'PENDING').length,
    failed: items.filter((n) => n.status === 'FAILED').length,
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search message, recipient, receipt…" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px] mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px] mt-1" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!items.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Send
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.sent}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Failed</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
      </div>

      <SectionCard title={`Notifications (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No notifications found for the selected filters." icon={Bell} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area divide-y">
            {items.map((n) => {
              const typeCfg = TYPE_CONFIG[n.type] || { label: n.type, icon: Bell, color: 'text-muted-foreground bg-muted', border: 'border-l-muted-foreground' }
              const Icon = typeCfg.icon
              const borderClass = STATUS_BORDER[n.status] || typeCfg.border
              return (
                <div
                  key={n.id}
                  className={cn('px-4 py-3 hover:bg-muted/40 flex gap-3 border-l-4', borderClass)}
                >
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', typeCfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{typeCfg.label}</span>
                      <Badge className={cn(STATUS_COLORS[n.status])}>{n.status}</Badge>
                      {n.collection && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {n.collection.receiptNumber} · {formatMoney(Number(n.collection.amount))}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto" title={formatDateTime(n.createdAt)}>
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-foreground/90">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">To: {n.recipient}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Recipient (mobile)</Label>
              <Input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Notification message…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={send}><Send className="h-4 w-4 mr-1" /> Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
