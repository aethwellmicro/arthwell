import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const account = await db.account.findUnique({ where: { id }, select: { id: true, accountNumber: true, status: true } })
    if (!account) return error('Account not found.', 404)

    const installments = await db.installment.findMany({
      where: { accountId: id },
      orderBy: { installNo: 'asc' },
    })
    const collections = await db.collection.findMany({
      where: { accountId: id, status: 'SUCCESSFUL' },
      select: { amount: true },
    })
    const totalPaid = collections.reduce((s, c) => s + Number(c.amount), 0)

    return json({
      account,
      installments: installments.map((i) => ({ ...i, amount: Number(i.amount), paidAmount: Number(i.paidAmount) })),
      totalPaid,
    })
  })
}
