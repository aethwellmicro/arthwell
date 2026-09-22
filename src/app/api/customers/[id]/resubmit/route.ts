import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!customer) return error('Customer not found.', 404)

    if (customer.status !== 'REJECTED') {
      return error(`Cannot resubmit customer in "${customer.status}" status. Only rejected customers can be resubmitted.`, 422)
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        status: 'PENDING_VERIFICATION',
        // Preserve rejection history in audit, but clear active rejection fields
        rejectionReason: null,
      },
    })

    await logAudit({
      user,
      action: 'CUSTOMER_RESUBMITTED',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: { status: 'REJECTED', previousRejection: customer.rejectionReason },
      newValue: { status: 'PENDING_VERIFICATION', resubmittedBy: user.name },
    })

    return json({ success: true, customer: updated })
  })
}
