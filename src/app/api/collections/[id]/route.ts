import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { num } from '@/lib/calc'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const c = await db.collection.findUnique({
      where: { id },
      include: {
        customer: true,
        account: true,
        collectedBy: { select: { name: true, employeeCode: true } },
        receipt: true,
        notification: true,
      },
    })
    if (!c) return error('Collection not found.', 404)
    return json({
      ...c,
      amount: num(c.amount),
      previousOutstanding: num(c.previousOutstanding),
      currentOutstanding: num(c.currentOutstanding),
      account: { ...c.account, principal: num(c.account.principal), totalPayable: num(c.account.totalPayable) },
    })
  })
}
