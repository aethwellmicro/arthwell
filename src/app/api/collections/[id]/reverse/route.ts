import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // reverse a collection (controlled, audited, no hard delete)
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const reason = (body.reason || '').toString().trim()
    if (!reason) return error('A reason is required to reverse a transaction.', 422)

    const collection = await db.collection.findUnique({ where: { id }, include: { account: true } })
    if (!collection) return error('Collection not found.', 404)
    if (collection.status !== 'SUCCESSFUL') return error('Only successful transactions can be reversed.', 422)

    const reversed = await db.collection.update({
      where: { id },
      data: { status: 'REVERSED', reversalReason: reason },
    })

    // deallocate from installments (FIFO reverse)
    await deallocateInstallments(collection.accountId, num(collection.amount))

    // if account was marked COMPLETED due to this, reopen
    await db.account.update({
      where: { id: collection.accountId },
      data: { status: 'ACTIVE' },
    }).catch(() => {})

    await logAudit({
      user,
      action: 'REVERSE',
      entity: 'COLLECTION',
      entityId: id,
      oldValue: { status: collection.status, amount: num(collection.amount) },
      newValue: { status: 'REVERSED', reason },
      reason,
    })

    return json({ ok: true, status: reversed.status })
  })
}

async function deallocateInstallments(accountId: string, amount: number) {
  const installments = await db.installment.findMany({
    where: { accountId, status: { in: ['PAID', 'PARTIAL'] } },
    orderBy: { installNo: 'desc' },
  })
  let remaining = amount
  for (const inst of installments) {
    if (remaining <= 0) break
    const paid = num(inst.paidAmount)
    const reduce = Math.min(paid, remaining)
    const newPaid = paid - reduce
    const status = newPaid <= 0.01 ? 'PENDING' : newPaid < num(inst.amount) - 0.01 ? 'PARTIAL' : 'PAID'
    await db.installment.update({
      where: { id: inst.id },
      data: { paidAmount: newPaid, status, paidDate: newPaid <= 0.01 ? null : inst.paidDate },
    })
    remaining -= reduce
  }
}
