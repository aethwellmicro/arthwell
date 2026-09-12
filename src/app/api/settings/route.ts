import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function GET() {
  return withAuth(async () => {
    const settings = await db.systemSetting.findMany()
    const obj: Record<string, string> = {}
    for (const s of settings) obj[s.key] = s.value
    return json(obj)
  })
}

export async function PUT(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Only Admin or Branch Manager can edit settings.', 403)
    }
    const body = await parseBody(req)
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue
      await db.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }
    await logAudit({ user, action: 'UPDATE', entity: 'SETTINGS', newValue: body })
    const settings = await db.systemSetting.findMany()
    const obj: Record<string, string> = {}
    for (const s of settings) obj[s.key] = s.value
    return json(obj)
  })
}
