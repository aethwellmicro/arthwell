import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        accounts: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!customer) return error('Customer not found.', 404)

    const collections = await db.collection.findMany({
      where: { customerId: id, status: 'SUCCESSFUL' },
      select: { amount: true, paymentMode: true },
    })
    const totalCollected = collections.reduce((s, c) => s + Number(c.amount), 0)
    const totalPayable = customer.accounts.reduce((s, a) => s + Number(a.totalPayable), 0)

    return json({
      ...customer,
      totalPayable,
      totalCollected,
      outstanding: Math.max(totalPayable - totalCollected, 0),
      paymentsByMode: collections.reduce((acc, c) => {
        acc[c.paymentMode] = (acc[c.paymentMode] || 0) + Number(c.amount)
        return acc
      }, {} as Record<string, number>),
    })
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) return error('Customer not found.', 404)

    const data: any = {}
    for (const k of ['fullName', 'primaryMobile', 'alternateMobile', 'address', 'city', 'area', 'occupation', 'referenceName', 'referenceMobile', 'photoUrl', 'idType', 'idNumber', 'status']) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k]
    }
    if (body.amount !== undefined) data.amount = parseFloat(body.amount) || 0
    const updated = await db.customer.update({ where: { id }, data })
    await logAudit({ user, action: 'UPDATE', entity: 'CUSTOMER', entityId: id, oldValue: existing, newValue: data })
    return json(updated)
  })
}
