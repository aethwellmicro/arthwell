import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || undefined
    const area = searchParams.get('area') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (q) {
      where.OR = [
        { fullName: { contains: q } },
        { primaryMobile: { contains: q } },
        { customerId: { contains: q } },
        { alternateMobile: { contains: q } },
      ]
    }
    if (status) where.status = status
    if (area) where.area = { contains: area }

    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          _count: { select: { accounts: true, collections: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.customer.count({ where }),
    ])

    const enriched = await Promise.all(
      items.map(async (c) => {
        const accounts = await db.account.findMany({
          where: { customerId: c.id },
          select: { totalPayable: true, status: true },
        })
        const collections = await db.collection.findMany({
          where: { customerId: c.id, status: 'SUCCESSFUL' },
          select: { amount: true },
        })
        const totalPayable = accounts.reduce((s, a) => s + Number(a.totalPayable), 0)
        const totalCollected = collections.reduce((s, c) => s + Number(c.amount), 0)
        return {
          ...c,
          totalPayable,
          totalCollected,
          outstanding: Math.max(totalPayable - totalCollected, 0),
        }
      })
    )

    return json({ items: enriched, total })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const fullName = (body.fullName || '').toString().trim()
    const primaryMobile = (body.primaryMobile || '').toString().trim()
    if (!fullName) return error('Full name is required.', 422)
    if (!primaryMobile) return error('Primary mobile number is required.', 422)

    const prefix = 'CUST'
    const last = await db.customer.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextN = 0
    if (last && last.customerId) {
      const m = last.customerId.match(/(\d+)$/)
      if (m) nextN = parseInt(m[1])
    }
    const customerId = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

    const customer = await db.customer.create({
      data: {
        customerId,
        fullName,
        primaryMobile,
        alternateMobile: body.alternateMobile || null,
        address: body.address || null,
        city: body.city || null,
        area: body.area || null,
        occupation: body.occupation || null,
        referenceName: body.referenceName || null,
        referenceMobile: body.referenceMobile || null,
        photoUrl: body.photoUrl || null,
        idType: body.idType || null,
        idNumber: body.idNumber || null,
        status: 'ACTIVE',
        createdById: user.id,
      },
    })

    await logAudit({ user, action: 'CREATE', entity: 'CUSTOMER', entityId: customer.id, newValue: { customerId, fullName, primaryMobile } })
    return json(customer, 201)
  })
}
