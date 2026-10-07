import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'
import { getBranchFilter } from '@/lib/branch'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const c = await db.collection.findFirst({
      where: { id, ...getBranchFilter(user) },
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

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const collection = await db.collection.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: {
        account: true,
        customer: true,
      },
    })
    if (!collection) return error('Collection entry not found.', 404)

    // Authorization: Admin or Branch Manager (scoped to branch)
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return error('Unauthorized to delete collection entries.', 403)
    }

    if (user.role === 'BRANCH_MANAGER' && user.branchId && collection.branchId && collection.branchId !== user.branchId) {
      return error('Not authorized to delete entries belonging to another branch.', 403)
    }

    await db.$transaction(async (tx) => {
      // 1. If collection was successful/approved, reverse installment allocations
      if (collection.status === 'SUCCESSFUL' || collection.status === 'APPROVED') {
        const amount = num(collection.amount)
        const installments = await tx.installment.findMany({
          where: { accountId: collection.accountId, status: { in: ['PAID', 'PARTIAL'] } },
          orderBy: { installNo: 'desc' },
        })
        let remaining = amount
        for (const inst of installments) {
          if (remaining <= 0) break
          const paid = num(inst.paidAmount)
          const reduce = Math.min(paid, remaining)
          const newPaid = paid - reduce
          const status = newPaid <= 0.01 ? 'PENDING' : newPaid < num(inst.amount) - 0.01 ? 'PARTIAL' : 'PAID'
          await tx.installment.update({
            where: { id: inst.id },
            data: { paidAmount: newPaid, status, paidDate: newPaid <= 0.01 ? null : inst.paidDate },
          })
          remaining -= reduce
        }

        // Reopen account if completed
        await tx.account.update({
          where: { id: collection.accountId },
          data: { status: 'ACTIVE' },
        }).catch(() => {})
      }

      // 2. Delete linked notifications
      await tx.notification.deleteMany({
        where: { collectionId: id },
      })

      // 3. Delete linked receipt
      await tx.receipt.deleteMany({
        where: { collectionId: id },
      })

      // 4. Delete collection entry
      await tx.collection.delete({
        where: { id },
      })
    })

    await logAudit({
      user,
      action: 'COLLECTION_DELETED',
      entity: 'COLLECTION',
      entityId: id,
      oldValue: {
        receiptNumber: collection.receiptNumber,
        amount: num(collection.amount),
        status: collection.status,
        customer: collection.customer?.fullName,
      },
    })

    return json({ success: true, message: 'Collection entry deleted successfully.' })
  })
}
