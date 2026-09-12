import { db } from '@/lib/db'
import { json, withAuth } from '@/lib/api'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || undefined
    const entity = searchParams.get('entity') || undefined
    const userId = searchParams.get('userId') || undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '200')

    const where: any = {}
    if (action) where.action = action
    if (entity) where.entity = entity
    if (userId) where.userId = userId
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
    }

    const logs = await db.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return json({ items: logs })
  })
}
