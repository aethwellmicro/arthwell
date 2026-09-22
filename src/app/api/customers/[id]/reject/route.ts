import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required.').max(500),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    // Only Branch Manager or Admin can reject
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Only Branch Managers or Admins can reject customers.', 403)
    }

    const { id } = await ctx.params
    const body = await parseBody(req)
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues[0].message, 422)
    }

    const customer = await db.customer.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!customer) return error('Customer not found.', 404)

    if (customer.status !== 'PENDING_VERIFICATION') {
      return error(`Cannot reject customer in "${customer.status}" status. Only pending verification customers can be rejected.`, 422)
    }

    const reason = parsed.data.reason.trim()
    const updated = await db.customer.update({
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
      action: 'CUSTOMER_REJECTED',
      entity: 'CUSTOMER',
      entityId: id,
      reason,
      oldValue: { status: customer.status },
      newValue: {
        status: 'REJECTED',
        rejectedBy: user.name,
        rejectedAt: updated.rejectedAt,
        rejectionReason: reason,
        group: customer.group?.name || null,
        branch: customer.branch,
      },
    })

    return json({ success: true, customer: updated })
  })
}
