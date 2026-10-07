import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'
import { getBranchFilter } from '@/lib/branch'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    // Only Back Office / Branch Manager / Admin can approve
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER' && user.role !== 'ACCOUNTANT') {
      return error('Unauthorized. Only Branch Back Office, Accountant or Admin can approve collections.', 403)
    }

    const { id } = await ctx.params
    const collection = await db.collection.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: {
        customer: true,
        account: {
          include: {
            installments: {
              where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
              orderBy: { installNo: 'asc' },
            },
          },
        },
      },
    })

    if (!collection) return error('Collection entry not found.', 404)
    if (collection.status !== 'PENDING_APPROVAL') {
      return error(`Collection is in status "${collection.status}". Only PENDING_APPROVAL collections can be approved.`, 422)
    }

    const amount = num(collection.amount)
    const account = collection.account
    const collectionDate = collection.collectionDate

    // Execute atomic approval and FIFO installment allocation
    const approved = await db.$transaction(async (tx) => {
      // 1. Installment allocation (FIFO)
      let remaining = amount
      let allocatedPrincipal = 0
      let allocatedInterest = 0

      for (const inst of account.installments) {
        if (remaining <= 0) break
        const due = num(inst.amount)
        const alreadyPaid = num(inst.paidAmount)
        const needed = Math.max(due - alreadyPaid, 0)
        if (needed <= 0) continue

        const pay = Math.min(needed, remaining)
        const newPaid = alreadyPaid + pay
        const status = newPaid >= due - 0.01 ? 'PAID' : 'PARTIAL'

        // Track principal / interest proportional distribution
        const pRatio = due > 0 ? num(inst.principalPart) / due : 0
        const iRatio = due > 0 ? num(inst.interestPart) / due : 0
        allocatedPrincipal += pay * pRatio
        allocatedInterest += pay * iRatio

        await tx.installment.update({
          where: { id: inst.id },
          data: { paidAmount: newPaid, status, paidDate: collectionDate },
        })
        remaining -= pay
      }

      // Calculate new outstanding after this approval
      const allApprovedAgg = await tx.collection.aggregate({
        where: { accountId: account.id, status: { in: ['APPROVED', 'SUCCESSFUL'] } },
        _sum: { amount: true },
      })
      const totalPaidSoFar = num(allApprovedAgg._sum.amount) + amount
      const totalPayable = num(account.totalPayable)
      const newOutstanding = Math.max(totalPayable - totalPaidSoFar, 0)

      // 2. Update collection status to APPROVED
      const updatedCollection = await tx.collection.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user.id,
          approvedAt: new Date(),
          currentOutstanding: newOutstanding,
          allocatedPrincipal,
          allocatedInterest,
        },
      })

      // 3. Complete loan account if fully settled
      if (newOutstanding <= 0.01) {
        await tx.account.update({
          where: { id: account.id },
          data: { status: 'COMPLETED' },
        })
      }

      // 4. Send SMS notification now that it is approved and finalized
      const message = `Dear ${collection.customer.fullName}, your collection of ₹${amount.toFixed(2)} (${collection.paymentMode}) has been approved and credited. Outstanding: ₹${newOutstanding.toFixed(2)}. Receipt: ${collection.receiptNumber}. Thank you.`
      await tx.notification.create({
        data: {
          collectionId: collection.id,
          customerId: collection.customerId,
          type: 'PAYMENT_CONFIRMATION',
          message,
          recipient: collection.customer.primaryMobile,
          status: 'SENT',
          userId: user.id,
        },
      })

      return updatedCollection
    })

    await logAudit({
      user,
      action: 'COLLECTION_APPROVED',
      entity: 'COLLECTION',
      entityId: id,
      oldValue: { status: 'PENDING_APPROVAL' },
      newValue: {
        status: 'APPROVED',
        approvedById: user.id,
        receiptNumber: collection.receiptNumber,
        amount,
      },
    })

    return json({
      ok: true,
      collection: {
        ...approved,
        amount: num(approved.amount),
        previousOutstanding: num(approved.previousOutstanding),
        currentOutstanding: num(approved.currentOutstanding),
      },
    })
  })
}
