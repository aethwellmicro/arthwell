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

export async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
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
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  COMPLETED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  OVERDUE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CLOSED: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  SUCCESSFUL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  REVERSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CANCELLED: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  SENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  BRANCH_MANAGER: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ACCOUNTANT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  COLLECTION_EMPLOYEE: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch Manager',
  ACCOUNTANT: 'Accountant',
  COLLECTION_EMPLOYEE: 'Collection Employee',
}
