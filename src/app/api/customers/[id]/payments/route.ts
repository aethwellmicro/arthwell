import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({ where: { id }, select: { fullName: true, customerId: true, primaryMobile: true } })
    if (!customer) return error('Customer not found.', 404)

    const collections = await db.collection.findMany({
      where: { customerId: id },
      include: {
        collectedBy: { select: { name: true, employeeCode: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { collectionDate: 'desc' },
    })

    // compute running balance chronologically
    const sorted = [...collections].sort((a, b) => a.collectionDate.getTime() - b.collectionDate.getTime())
    let running = 0
    const balances = new Map<string, number>()
    // need totalPayable per account
    const accountTotals = new Map<string, number>()
    const accs = await db.account.findMany({ where: { customerId: id }, select: { id: true, totalPayable: true } })
    for (const a of accs) accountTotals.set(a.id, Number(a.totalPayable))

    for (const c of sorted) {
      if (c.status === 'SUCCESSFUL') running += Number(c.amount)
      balances.set(c.id, Math.max((accountTotals.get(c.accountId) || 0) - running, 0))
    }

    const items = collections.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptNumber,
      accountId: c.accountId,
      accountNumber: c.account.accountNumber,
      collectionDate: c.collectionDate,
      amount: Number(c.amount),
      paymentMode: c.paymentMode,
      collectedBy: c.collectedBy.name,
      collectedByCode: c.collectedBy.employeeCode,
      previousOutstanding: Number(c.previousOutstanding),
      currentOutstanding: Number(c.currentOutstanding),
      balanceAfter: balances.get(c.id) ?? Number(c.currentOutstanding),
      remarks: c.remarks,
      status: c.status,
      reversalReason: c.reversalReason,
    }))

    return json({ customer, items })
  })
}
