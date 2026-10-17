import { formatMoney as _fmt, formatMoneyPlain as _fmtPlain } from '@/lib/money'

export const formatMoney = (v: number | string | undefined | null): string => {
  const n = typeof v === 'undefined' || v === null ? 0 : Number(v)
  return _fmt(n)
}

export const formatMoneyPlain = (v: number | string | undefined | null): string => {
  const n = typeof v === 'undefined' || v === null ? 0 : Number(v)
  return _fmtPlain(n)
}

// Compact money format for KPI cards / tight spaces: ₹4.7L, ₹1.2Cr, ₹12.5k
export const formatMoneyCompact = (v: number | string | undefined | null): string => {
  const n = typeof v === 'undefined' || v === null ? 0 : Number(v)
  if (n === 0) return '₹0'
  const abs = Math.abs(n)
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n.toFixed(0)}`
}

export const formatDate = (d: string | Date | undefined | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatDateTime = (d: string | Date | undefined | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatTime = (d: string | Date | undefined | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export const formatDateInput = (d: string | Date | undefined | null): string => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}

export const todayInput = (): string => {
  return new Date().toISOString().slice(0, 10)
}

// Enforces strict 10-digit numeric mobile number limitation
export const sanitizeMobile = (val: string | null | undefined): string => {
  if (!val) return ''
  return val.replace(/\D/g, '').slice(0, 10)
}

// Relative time: "2h ago", "3d ago", "just now"
export const formatRelativeTime = (d: string | Date | undefined | null): string => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  const diff = Date.now() - dt.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 4) return `${wk}w ago`
  return formatDate(d)
}

const inFlightGetRequests = new Map<string, Promise<any>>()

export async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()

  // Deduplicate concurrent in-flight GET requests
  if (method === 'GET' && !init?.cache && inFlightGetRequests.has(url)) {
    return inFlightGetRequests.get(url)! as Promise<T>
  }

  const requestPromise = (async () => {
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
        ...init,
      })
      const text = await res.text()
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      if (!res.ok) {
        throw new Error((data && data.error) || `Request failed (${res.status})`)
      }
      return data as T
    } finally {
      if (method === 'GET') {
        inFlightGetRequests.delete(url)
      }
    }
  })()

  if (method === 'GET' && !init?.cache) {
    inFlightGetRequests.set(url, requestPromise)
  }

  return requestPromise
}

export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'border border-[#ebebeb] bg-white text-[#171717] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]',
  COMPLETED: 'border border-[#ebebeb] bg-white text-[#171717] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]',
  OVERDUE: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  CLOSED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#8f8f8f] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#8f8f8f]',
  BLOCKED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  SUCCESSFUL: 'border border-[#ebebeb] bg-white text-[#171717] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]',
  REVERSED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#8f8f8f] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#8f8f8f]',
  CANCELLED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#8f8f8f] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#8f8f8f]',
  PENDING: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  PENDING_APPROVAL: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  PENDING_VERIFICATION: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  APPROVED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  READY_FOR_DISBURSEMENT: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  REJECTED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] font-medium dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  DISBURSED: 'border border-[#171717]/20 bg-[#f5f5f5] text-[#171717] dark:border-[#ededed]/20 dark:bg-[#1a1a1a] dark:text-[#ededed] font-medium',
  PAID: 'border border-[#ebebeb] bg-white text-[#171717] dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#ededed]',
  PARTIAL: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  SENT: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
  FAILED: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#171717] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#ededed]',
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#a1a1a1]',
  BRANCH_MANAGER: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#a1a1a1]',
  ACCOUNTANT: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#a1a1a1]',
  COLLECTION_EMPLOYEE: 'border border-[#ebebeb] bg-[#f5f5f5] text-[#4d4d4d] dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-[#a1a1a1]',
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch Manager',
  ACCOUNTANT: 'Accountant',
  COLLECTION_EMPLOYEE: 'Collection Employee',
}
