import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    // Only Back Office / Branch Manager / Admin can reject
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER' && user.role !== 'ACCOUNTANT') {
      return error('Unauthorized. Only Branch Back Office, Accountant or Admin can reject collections.', 403)
    }

    const { id } = await ctx.params
    const body = await parseBody(req)
    const reason = (body.reason || '').toString().trim()

    if (!reason || reason.length === 0) {
      return error('A mandatory rejection reason is required to reject a collection.', 422)
    }

    const collection = await db.collection.findUnique({
      where: { id },
    })

    if (!collection) return error('Collection entry not found.', 404)
    if (collection.status !== 'PENDING_APPROVAL') {
      return error(`Collection is in status "${collection.status}". Only PENDING_APPROVAL collections can be rejected.`, 422)
    }

    const rejected = await db.collection.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    })

    await logAudit({
      user,
      action: 'COLLECTION_REJECTED',
      entity: 'COLLECTION',
      entityId: id,
      oldValue: { status: 'PENDING_APPROVAL' },
      newValue: {
        status: 'REJECTED',
        rejectedById: user.id,
        rejectionReason: reason,
        receiptNumber: collection.receiptNumber,
        amount: num(collection.amount),
      },
      reason,
    })

    return json({
      ok: true,
      collection: {
        ...rejected,
        amount: num(rejected.amount),
        previousOutstanding: num(rejected.previousOutstanding),
        currentOutstanding: num(rejected.currentOutstanding),
      },
    })
  })
}
