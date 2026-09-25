import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const collection = await db.collection.findUnique({
      where: { id },
      include: { account: true },
    })

    if (!collection) return error('Collection entry not found.', 404)
    if (collection.status !== 'REJECTED') {
      return error(`Collection is in status "${collection.status}". Only REJECTED collections can be resubmitted.`, 422)
    }

    // Only collector or manager/admin can resubmit
    if (collection.collectedById !== user.id && user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return error('Unauthorized. Only the original Field Officer or Branch Manager can resubmit this collection.', 403)
    }

    const body = await parseBody(req)
    const newAmount = body.amount !== undefined ? parseFloat(body.amount) : undefined
    const remarks = body.remarks !== undefined ? body.remarks.toString() : collection.remarks

    const updateData: any = {
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
      rejectedById: null,
      rejectedAt: null,
      remarks: remarks || null,
    }

    if (newAmount && !isNaN(newAmount) && newAmount > 0) {
      updateData.amount = newAmount
    }

    const resubmitted = await db.collection.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      user,
      action: 'COLLECTION_RESUBMITTED',
      entity: 'COLLECTION',
      entityId: id,
      oldValue: { status: 'REJECTED', reason: collection.rejectionReason },
      newValue: {
        status: 'PENDING_APPROVAL',
        amount: num(resubmitted.amount),
        receiptNumber: collection.receiptNumber,
      },
    })

    return json({
      ok: true,
      collection: {
        ...resubmitted,
        amount: num(resubmitted.amount),
        previousOutstanding: num(resubmitted.previousOutstanding),
        currentOutstanding: num(resubmitted.currentOutstanding),
      },
    })
  })
}
