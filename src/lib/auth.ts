import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { db } from './db'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'cls_session'
const SESSION_DAYS = 7

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64)
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf)
}

export { hashPassword }

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  employeeCode?: string | null
  phone?: string | null
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  return token
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      return null
    }
    if (!session.user.active) return null
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      employeeCode: session.user.employeeCode,
      phone: session.user.phone,
    }
  } catch {
    return null
  }
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { token } }).catch(() => {})
}

export function getTokenFromRequest(req: Request): string | undefined {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  return match?.[1]
}

export const ROLE_ADMIN = 'ADMIN'
export const ROLE_BRANCH_MANAGER = 'BRANCH_MANAGER'
export const ROLE_ACCOUNTANT = 'ACCOUNTANT'
export const ROLE_COLLECTION_EMPLOYEE = 'COLLECTION_EMPLOYEE'

export function canManageFinancialConfig(role: string): boolean {
  return role === ROLE_ADMIN || role === ROLE_BRANCH_MANAGER
}

export function canReverseTransactions(role: string): boolean {
  return role === ROLE_ADMIN || role === ROLE_BRANCH_MANAGER || role === ROLE_ACCOUNTANT
}
