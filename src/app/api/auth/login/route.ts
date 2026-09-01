import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'
import { json, error, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const body = await parseBody(req)
  const email = (body.email || '').toString().trim().toLowerCase()
  const password = (body.password || '').toString()

  if (!email || !password) return error('Email and password are required.', 422)

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.active) {
    return error('Invalid credentials or inactive account.', 401)
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return error('Invalid credentials.', 401)
  }

  const token = await createSession(user.id)
  await setSessionCookie(token)
  await logAudit({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, action: 'LOGIN', entity: 'USER', entityId: user.id })

  return json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, employeeCode: user.employeeCode, phone: user.phone },
  })
}
