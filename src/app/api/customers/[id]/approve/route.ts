import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    // Only Branch Manager or Admin can approve
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Only Branch Managers or Admins can approve customers.', 403)
    }

    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!customer) return error('Customer not found.', 404)

    // State machine check: can only approve PENDING_VERIFICATION or previously REJECTED
    if (customer.status !== 'PENDING_VERIFICATION' && customer.status !== 'REJECTED') {
      return error(`Cannot approve customer in "${customer.status}" status. Only PENDING_VERIFICATION or REJECTED can be approved.`, 422)
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    })

    await logAudit({
      user,
      action: 'CUSTOMER_APPROVED',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: { status: customer.status },
      newValue: {
        status: 'APPROVED',
        approvedBy: user.name,
        approvedAt: updated.approvedAt,
        group: customer.group?.name || null,
        branch: customer.branch,
      },
    })

    return json({ success: true, customer: updated })
  })
}
