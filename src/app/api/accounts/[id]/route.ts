import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const account = await db.account.findUnique({
      where: { id },
      include: { customer: true, product: true, createdBy: { select: { name: true } } },
    })
    if (!account) return error('Account not found.', 404)

    const collected = await db.collection.aggregate({
      where: { accountId: id, status: 'SUCCESSFUL' },
      _sum: { amount: true },
    })
    const paid = Number(collected._sum.amount || 0)
    const totalPayable = Number(account.totalPayable)

    const installments = await db.installment.findMany({
      where: { accountId: id },
      orderBy: { installNo: 'asc' },
    })

    return json({
      ...account,
      principal: Number(account.principal),
      interestRate: Number(account.interestRate),
      installmentAmount: Number(account.installmentAmount),
      savingsAmount: Number(account.savingsAmount || 0),
      processingFee: Number(account.processingFee || 0),
      insurancePremium: Number(account.insurancePremium || 0),
      totalFees: Number(account.processingFee || 0) + Number(account.insurancePremium || 0),
      totalPayable,
      totalInterest: Number(account.totalInterest),
      paidAmount: paid,
      outstanding: Math.max(totalPayable - paid, 0),
      installments: installments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        savingsPart: Number(i.savingsPart || 0),
        paidAmount: Number(i.paidAmount),
        paidSavings: Number(i.paidSavings || 0),
      })),
    })
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) return error('Account not found.', 404)

    const data: any = {}
    for (const k of ['status', 'remarks']) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k]
    }
    const updated = await db.account.update({ where: { id }, data })
    return json({ ...updated, principal: Number(updated.principal), totalPayable: Number(updated.totalPayable) })
  })
}
