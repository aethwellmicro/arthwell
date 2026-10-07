import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { getBranchFilter } from '@/lib/branch'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const customer = await db.customer.findFirst({
      where: { id, ...getBranchFilter(user) },
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
    const existing = await db.customer.findFirst({ where: { id, ...getBranchFilter(user) } })
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
      'groupId',
    ]) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k]
    }
    if (user.role === ROLE_ADMIN && body.branch !== undefined) {
      data.branch = body.branch === '' ? null : body.branch
    }

    if (body.amount !== undefined) data.amount = parseFloat(body.amount) || 0

    // If changing group, ensure group exists and is active
    if (data.groupId && data.groupId !== existing.groupId) {
      const g = await db.group.findFirst({
        where: { id: data.groupId, ...getBranchFilter(user) },
      })
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
    const existing = await db.customer.findFirst({
      where: { id, ...getBranchFilter(user) },
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

    // Only Administrator and Branch Manager can delete customers
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER && user.id !== existing.createdById) {
      return error('Unauthorized to delete this customer.', 403)
    }

    const hasFinancialRecords = existing._count.accounts > 0 || existing._count.collections > 0

    // Non-admin can only delete if customer has 0 loans and 0 collections
    if (user.role !== ROLE_ADMIN && hasFinancialRecords) {
      return error('Customer cannot be deleted because financial records are associated with this customer. Only an Administrator can perform full customer deletion.', 422)
    }

    // Branch manager branch check
    if (user.role === ROLE_BRANCH_MANAGER && user.branchId && existing.branchId && existing.branchId !== user.branchId) {
      return error('Not authorized to delete customers belonging to another branch.', 403)
    }

    // Perform deletion
    if (hasFinancialRecords) {
      // Full administrative deletion with cascading clean-up
      await db.$transaction(async (tx) => {
        // 1. Delete notifications related to collections of this customer or directly to this customer
        await tx.notification.deleteMany({
          where: {
            OR: [
              { customerId: id },
              { collection: { customerId: id } },
            ],
          },
        })

        // 2. Delete receipts associated with collections of this customer
        await tx.receipt.deleteMany({
          where: {
            collection: { customerId: id },
          },
        })

        // 3. Delete collections
        await tx.collection.deleteMany({
          where: { customerId: id },
        })

        // 4. Delete installments for all accounts of this customer
        await tx.installment.deleteMany({
          where: {
            account: { customerId: id },
          },
        })

        // 5. Delete accounts
        await tx.account.deleteMany({
          where: { customerId: id },
        })

        // 6. Delete customer record
        await tx.customer.delete({
          where: { id },
        })
      })
    } else {
      // Safe direct delete for customer with 0 accounts/collections
      await db.customer.delete({ where: { id } })
    }

    await logAudit({
      user,
      action: 'CUSTOMER_DELETED',
      entity: 'CUSTOMER',
      entityId: id,
      oldValue: {
        customerId: existing.customerId,
        fullName: existing.fullName,
        primaryMobile: existing.primaryMobile,
        hadFinancialRecords: hasFinancialRecords,
      },
    })

    return json({ success: true, message: 'Customer deleted successfully.' })
  })
}
