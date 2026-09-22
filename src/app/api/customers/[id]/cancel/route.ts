import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required.').max(500),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues[0].message, 422)
    }

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        accounts: { where: { status: 'ACTIVE' } },
      },
    })
    if (!customer) return error('Customer not found.', 404)

    if (customer.status === 'CANCELLED') {
      return error('Customer is already cancelled.', 422)
    }

    // If customer has an active loan account, cancellation requires financial reversal process
    if (customer.accounts.length > 0) {
      return error('This customer has an active financial account. Use the approved financial reversal process instead of cancelling the customer record.', 422)
    }

    const reason = parsed.data.reason.trim()
    const updated = await db.customer.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledById: user.id,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    })

    await logAudit({
      user,
      action: 'CUSTOMER_CANCELLED',
      entity: 'CUSTOMER',
      entityId: id,
      reason,
      oldValue: { status: customer.status },
      newValue: {
        status: 'CANCELLED',
        cancelledBy: user.name,
        cancelledAt: updated.cancelledAt,
        cancellationReason: reason,
      },
    })

    return json({ success: true, customer: updated })
  })
}
