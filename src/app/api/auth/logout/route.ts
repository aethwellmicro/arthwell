import { db } from '@/lib/db'
import { getSession, destroySession, clearSessionCookie, getTokenFromRequest } from '@/lib/auth'
import { json, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const token = getTokenFromRequest(req)
    if (token) await destroySession(token)
    await clearSessionCookie()
    await logAudit({ user, action: 'LOGOUT', entity: 'USER', entityId: user.id })
    return json({ ok: true })
  })
}
