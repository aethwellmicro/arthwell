import { db } from '@/lib/db'
import { json, withAuth, parseBody } from '@/lib/api'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const notifications = await db.notification.findMany({
      where: { AND: [status ? { status } : {}, type ? { type } : {}] },
      include: { collection: { select: { receiptNumber: true, amount: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return json({ items: notifications.map((n) => ({ ...n, amount: n.collection ? Number(n.collection.amount) : null })) })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const type = (body.type || '').toString()
    const message = (body.message || '').toString()
    const recipient = (body.recipient || '').toString()
    const customerId = body.customerId || null
    if (!type || !message || !recipient) return json({ error: 'type, message, recipient required' }, 422)
    const n = await db.notification.create({
      data: { type, message, recipient, customerId, status: 'SENT', userId: user.id },
    })
    return json(n, 201)
  })
}
