import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { ROLE_ADMIN } from '@/lib/auth'
import { main as seedMain } from '@/lib/seed-data'
import { logAudit } from '@/lib/audit'

export async function POST() {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) return error('Only Admin can re-seed the database.', 403)
    await seedMain()
    await logAudit({ user, action: 'CREATE', entity: 'SYSTEM', newValue: 'Database re-seeded' })
    return json({ ok: true })
  })
}
