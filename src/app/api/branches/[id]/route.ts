import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { ROLE_ADMIN } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    const { id } = await params
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true, phone: true } },
        users: { select: { id: true, name: true, email: true, role: true, phone: true, active: true } },
        _count: {
          select: {
            customers: true,
            accounts: true,
            collections: true,
            investments: true,
            expenses: true,
          },
        },
      },
    })

    if (!branch) return error('Branch not found.', 404)

    // Calculate aggregated branch financial stats
    const [collectionsAgg, accountsAgg, investmentsAgg, expensesAgg] = await Promise.all([
      db.collection.aggregate({
        where: { branchId: id, status: 'SUCCESSFUL' },
        _sum: { amount: true },
      }),
      db.account.aggregate({
        where: { branchId: id, status: { not: 'CANCELLED' } },
        _sum: { principal: true, totalPayable: true },
      }),
      db.investment.aggregate({
        where: { branchId: id, status: { not: 'CANCELLED' } },
        _sum: { amount: true },
      }),
      db.expense.aggregate({
        where: { branchId: id, status: { not: 'CANCELLED' } },
        _sum: { amount: true },
      }),
    ])

    return json({
      branch,
      financials: {
        totalCollected: num(collectionsAgg._sum.amount),
        totalDisbursed: num(accountsAgg._sum.principal),
        totalReceivable: num(accountsAgg._sum.totalPayable),
        totalInvestments: num(investmentsAgg._sum.amount),
        totalExpenses: num(expensesAgg._sum.amount),
      },
    })
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Only Administrator can modify branches.', 403)
    }

    const { id } = await params
    const branch = await db.branch.findUnique({ where: { id } })
    if (!branch) return error('Branch not found.', 404)

    const body = await parseBody(req)
    const updateData: any = {}

    if (body.name !== undefined) {
      const name = body.name.toString().trim()
      if (!name) return error('Branch name cannot be empty.', 422)
      updateData.name = name
    }
    if (body.city !== undefined) updateData.city = body.city?.toString().trim() || null
    if (body.state !== undefined) updateData.state = body.state?.toString().trim() || null
    if (body.address !== undefined) updateData.address = body.address?.toString().trim() || null
    if (body.phone !== undefined) updateData.phone = body.phone?.toString().trim() || null
    if (body.email !== undefined) updateData.email = body.email?.toString().trim().toLowerCase() || null
    if (body.status !== undefined) updateData.status = body.status
    if (body.managerId !== undefined) {
      updateData.managerId = body.managerId ? body.managerId.toString().trim() : null
      if (updateData.managerId) {
        await db.user.update({
          where: { id: updateData.managerId },
          data: { branchId: id },
        }).catch(() => {})
      }
    }

    const updated = await db.branch.update({
      where: { id },
      data: updateData,
      include: {
        manager: { select: { id: true, name: true } },
      },
    })

    await logAudit({
      user,
      action: 'BRANCH_UPDATED',
      entity: 'BRANCH',
      entityId: id,
      oldValue: branch,
      newValue: updated,
    })

    return json({ branch: updated })
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Only an Administrator can delete branches.', 403)
    }

    const { id } = await params
    const branch = await db.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            groups: true,
            customers: true,
            accounts: true,
            collections: true,
            investments: true,
            expenses: true,
            bankDeposits: true,
          },
        },
      },
    })

    if (!branch) return error('Branch not found.', 404)

    const totalBranches = await db.branch.count()
    if (totalBranches <= 1) {
      return error('Cannot delete the last remaining branch.', 422)
    }

    const linkedCount =
      branch._count.users +
      branch._count.groups +
      branch._count.customers +
      branch._count.accounts +
      branch._count.collections +
      branch._count.investments +
      branch._count.expenses +
      branch._count.bankDeposits

    if (linkedCount > 0) {
      return error(
        `Cannot delete branch "${branch.name}" because it has active linked records (${branch._count.customers} customers, ${branch._count.users} employees, ${branch._count.accounts} accounts). Reassign records or set status to INACTIVE.`,
        422
      )
    }

    await db.branch.delete({ where: { id } })

    await logAudit({
      user,
      action: 'BRANCH_DELETED',
      entity: 'BRANCH',
      entityId: id,
      oldValue: branch,
    })

    return json({ success: true, message: 'Branch deleted successfully.' })
  })
}
