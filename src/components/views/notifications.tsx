'use client'

import { useEffect, useState } from 'react'
import { Bell, Plus, Send } from 'lucide-react'
import { apiFetch, formatDateTime, STATUS_COLORS, formatDate } from '@/lib/format'
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

const TYPE_LABELS: Record<string, string> = {
  PAYMENT_CONFIRMATION: 'Payment Confirmation',
  DUE_REMINDER: 'Due Reminder',
  OVERDUE_REMINDER: 'Overdue Reminder',
  ACCOUNT_COMPLETION: 'Account Completion',
}

export function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ type: 'DUE_REMINDER', recipient: '', message: '' })

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const data = await apiFetch<{ items: Notification[] }>(`/api/notifications?${params}`)
      setItems(data.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [typeFilter, statusFilter])

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)} className="ml-auto"><Plus className="h-4 w-4 mr-1" /> Send Notification</Button>
      </div>

      <SectionCard title={`Notifications (${items.length})`}>
        {loading ? (
          <LoadingRows rows={6} />
        ) : items.length === 0 ? (
          <EmptyState message="No notifications found." icon={Bell} />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area divide-y">
            {items.map((n) => (
              <div key={n.id} className="px-4 py-3 hover:bg-muted/40 flex gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{TYPE_LABELS[n.type] || n.type}</Badge>
                    <Badge className={cn(STATUS_COLORS[n.status])}>{n.status}</Badge>
                    {n.collection && <span className="text-xs text-muted-foreground">Receipt {n.collection.receiptNumber} · {formatDate(n.collection.amount)}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">To: {n.recipient}</p>
                </div>
              </div>
            ))}
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
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
