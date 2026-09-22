import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, groupId: true, name: true, branch: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
        accounts: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!customer) return error('Customer not found.', 404)

    const collections = await db.collection.findMany({
      where: { customerId: id, status: 'SUCCESSFUL' },
      select: { amount: true, paymentMode: true },
    })
    const totalCollected = collections.reduce((s, c) => s + Number(c.amount), 0)
    const totalPayable = customer.accounts.reduce((s, a) => s + Number(a.totalPayable), 0)

    return json({
      ...customer,
      totalPayable,
      totalCollected,
      outstanding: Math.max(totalPayable - totalCollected, 0),
      paymentsByMode: collections.reduce((acc, c) => {
        acc[c.paymentMode] = (acc[c.paymentMode] || 0) + Number(c.amount)
        return acc
      }, {} as Record<string, number>),
    })
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) return error('Customer not found.', 404)

    const data: any = {}
    for (const k of [
      'fullName',
      'primaryMobile',
      'alternateMobile',
      'address',
      'city',
      'area',
      'occupation',
      'referenceName',
      'referenceMobile',
      'photoUrl',
      'idType',
      'idNumber',
      'branch',
      'groupId',
    ]) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k]
    }

    if (body.amount !== undefined) data.amount = parseFloat(body.amount) || 0

    // If changing group, ensure group exists and is active
    if (data.groupId && data.groupId !== existing.groupId) {
      const g = await db.group.findUnique({ where: { id: data.groupId } })
      if (!g) return error('Selected group does not exist.', 404)
      if (g.status !== 'ACTIVE') return error(`Cannot assign customer to ${g.status.toLowerCase()} group.`, 422)
      data.branch = g.branch
    }

    // Role-protected status changes directly via PATCH (only Admin/Manager)
    if (body.status && body.status !== existing.status) {
      if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
        return error('Unauthorized to change customer status directly. Use approval or cancellation actions.', 403)
      }
      data.status = body.status
    }

    const updated = await db.customer.update({
      where: { id },
      data,
      include: {
        group: { select: { id: true, groupId: true, name: true } },
      },
    })

    await logAudit({
      user,
      action: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: existing,
      newValue: data,
    })

    return json(updated)
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const existing = await db.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
            collections: true,
          },
        },
      },
    })
    if (!existing) return error('Customer not found.', 404)

    // Hard delete rule: ONLY allowed if 0 accounts and 0 collections exist
    if (existing._count.accounts > 0 || existing._count.collections > 0) {
      return error('Customer cannot be deleted because financial records are associated with this customer. Use Cancel instead.', 422)
    }

    // Authorization check: Admin, Branch Manager, or creator
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER && user.id !== existing.createdById) {
      return error('Unauthorized to delete this customer.', 403)
    }

    await db.customer.delete({ where: { id } })

    await logAudit({
      user,
      action: 'CUSTOMER_DELETED',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: { customerId: existing.customerId, fullName: existing.fullName, primaryMobile: existing.primaryMobile },
    })

    return json({ success: true, message: 'Customer deleted successfully.' })
  })
}
