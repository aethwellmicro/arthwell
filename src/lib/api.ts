import { NextResponse } from 'next/server'
import { getSession, type SessionUser } from './auth'

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function requireAuth(): Promise<SessionUser | null> {
  return await getSession()
}

export function unauthorized() {
  return error('Unauthorized. Please log in.', 401)
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return error(message, 403)
}

export async function withAuth(
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await requireAuth()
  if (!user) return unauthorized()
  return handler(user)
}

export async function parseBody<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}

// generate next sequential code like CUST-0001
export function nextCode(prefix: string, maxNum: number): string {
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`
}

export function toISODate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10)
}

export function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

export function endOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(23, 59, 59, 999)
  return n
}

export function startOfWeek(d: Date): Date {
  const n = startOfDay(d)
  const day = n.getDay()
  const diff = (day + 6) % 7 // Monday as start
  n.setDate(n.getDate() - diff)
  return n
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function addMonths(d: Date, m: number): Date {
  const n = new Date(d)
  n.setMonth(n.getMonth() + m)
  return n
}
