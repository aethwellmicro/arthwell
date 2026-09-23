import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const accounts = await db.account.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    })
    const enriched = await Promise.all(
      accounts.map(async (a) => {
        const collected = await db.collection.aggregate({
          where: { accountId: a.id, status: 'SUCCESSFUL' },
          _sum: { amount: true },
        })
        const paid = Number(collected._sum.amount || 0)
        return {
          ...a,
          principal: Number(a.principal),
          interestRate: Number(a.interestRate),
          installmentAmount: Number(a.installmentAmount),
          totalPayable: Number(a.totalPayable),
          totalInterest: Number(a.totalInterest),
          processingFee: Number(a.processingFee || 0),
          insurancePremium: Number(a.insurancePremium || 0),
          totalFees: Number(a.processingFee || 0) + Number(a.insurancePremium || 0),
          paidAmount: paid,
          outstanding: Math.max(Number(a.totalPayable) - paid, 0),
        }
      })
    )
    return json({ items: enriched })
  })
}
