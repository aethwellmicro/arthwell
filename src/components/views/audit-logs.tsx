'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollText, ChevronDown, ChevronRight, Search, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { apiFetch, formatDateTime, formatRelativeTime, downloadCSV } from '@/lib/format'
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
import { SectionCard, EmptyState, LoadingRows } from '@/components/ui-bits'
import { Pagination } from '@/components/pagination'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  action: string
  entity: string
  entityId?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  createdAt: string
  user?: { name: string; email: string; role: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  UPDATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  REVERSE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LOGIN: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  LOGOUT: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

const ACTION_BORDERS: Record<string, string> = {
  CREATE: 'border-l-emerald-500',
  UPDATE: 'border-l-teal-500',
  DELETE: 'border-l-red-500',
  REVERSE: 'border-l-amber-500',
  LOGIN: 'border-l-slate-400',
  LOGOUT: 'border-l-slate-400',
}

const ACTION_ICONS: Record<string, any> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  REVERSE: '↩️',
  LOGIN: '🔑',
  LOGOUT: '🚪',
}

export function AuditLogsView() {
  const [items, setItems] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('ALL')
  const [entity, setEntity] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '300' })
      if (action !== 'ALL') params.set('action', action)
      if (entity !== 'ALL') params.set('entity', entity)
      if (from) params.set('from', from)
      if (to) params.set('to', to + 'T23:59:59')
      const data = await apiFetch<{ items: AuditLog[] }>(`/api/audit-logs?${params}`)
      setItems(data.items)
      setPage(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [action, entity, from, to])

  useEffect(() => {
    load()
  }, [load])

  // client-side search filter
  const filteredItems = search
    ? items.filter((l) => {
        const q = search.toLowerCase()
        return (
          (l.user?.name || '').toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entity.toLowerCase().includes(q) ||
          (l.reason || '').toLowerCase().includes(q) ||
          (l.newValue || '').toLowerCase().includes(q) ||
          (l.entityId || '').toLowerCase().includes(q)
        )
      })
    : items

  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  function prettyJson(s?: string | null) {
    if (!s) return null
    try {
      return JSON.stringify(JSON.parse(s), null, 2)
    } catch {
      return s
    }
  }

  function exportCSV() {
    if (!filteredItems.length) return toast.info('No audit logs to export')
    downloadCSV(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, filteredItems.map((l) => ({
      timestamp: formatDateTime(l.createdAt),
      user: l.user?.name || 'system',
      email: l.user?.email || '',
      role: l.user?.role || '',
      action: l.action,
      entity: l.entity,
      entityId: l.entityId || '',
      reason: l.reason || '',
      oldValue: l.oldValue || '',
      newValue: l.newValue || '',
    })))
    toast.success('Exported to CSV')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search user, entity, reason…" className="pl-8" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="REVERSE">Reverse</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Entity</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
              <SelectItem value="ACCOUNT">Account</SelectItem>
              <SelectItem value="COLLECTION">Collection</SelectItem>
              <SelectItem value="USER">User</SelectItem>
              <SelectItem value="RECEIPT">Receipt</SelectItem>
              <SelectItem value="SETTINGS">Settings</SelectItem>
              <SelectItem value="SYSTEM">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!filteredItems.length}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      <SectionCard title={`Audit Logs (${filteredItems.length})`} description="Complete chronological activity trail">
        {loading ? (
          <LoadingRows rows={6} />
        ) : filteredItems.length === 0 ? (
          <EmptyState message="No audit entries for the selected filters." icon={ScrollText} />
        ) : (
          <>
          <div className="max-h-[60vh] overflow-y-auto scroll-area divide-y">
            {paginatedItems.map((l) => {
              const isOpen = expanded === l.id
              const oldJ = prettyJson(l.oldValue)
              const newJ = prettyJson(l.newValue)
              const hasDetail = !!(oldJ || newJ || l.reason)
              return (
                <div key={l.id} className={cn('px-4 py-2.5 hover:bg-muted/40 border-l-4', ACTION_BORDERS[l.action] || 'border-l-slate-300')}>
                  <button
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setExpanded(hasDetail ? (isOpen ? null : l.id) : null)}
                  >
                    {hasDetail ? (
                      isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : <span className="w-4" />}
                    <span className="text-base shrink-0" aria-hidden>{ACTION_ICONS[l.action] || '•'}</span>
                    <Badge className={cn(ACTION_COLORS[l.action] || 'bg-slate-200 text-slate-700')}>{l.action}</Badge>
                    <Badge variant="outline">{l.entity}</Badge>
                    {l.entityId && <span className="font-mono text-xs text-muted-foreground hidden md:inline">{l.entityId.slice(0, 12)}</span>}
                    <span className="text-sm flex-1 truncate">
                      {l.reason || (newJ ? newJ.slice(0, 80) : l.action.toLowerCase() + ' ' + l.entity.toLowerCase())}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">{l.user?.name || 'system'}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap" title={formatDateTime(l.createdAt)}>
                      {formatRelativeTime(l.createdAt)}
                    </span>
                  </button>
                  {isOpen && hasDetail && (
                    <div className="mt-2 ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {l.reason && (
                        <div className="md:col-span-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2 text-xs">
                          <span className="font-medium text-amber-800 dark:text-amber-300">Reason: </span>{l.reason}
                        </div>
                      )}
                      {oldJ && (
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Old Value</p>
                          <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto scroll-area whitespace-pre-wrap">{oldJ}</pre>
                        </div>
                      )}
                      {newJ && (
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">New Value</p>
                          <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto scroll-area whitespace-pre-wrap">{newJ}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {filteredItems.length > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredItems.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
