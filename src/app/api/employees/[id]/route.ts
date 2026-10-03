import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { hashPassword, ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return error('Employee not found.', 404)

    // Admin, Branch Manager, or self
    const isSelf = user.id === id
    const isAdmin = user.role === ROLE_ADMIN
    const isBranchManager = user.role === ROLE_BRANCH_MANAGER

    if (!isSelf && !isAdmin && !isBranchManager) {
      return error('Not authorized to edit this employee.', 403)
    }

    // If Branch Manager, ensure the employee belongs to their branch
    if (isBranchManager && !isAdmin && !isSelf) {
      if (user.branchId && existing.branchId && existing.branchId !== user.branchId) {
        return error('Not authorized to edit employees of other branches.', 403)
      }
    }

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.phone !== undefined) data.phone = body.phone || null
    if (body.employeeCode !== undefined) data.employeeCode = body.employeeCode || null
    if (body.password) {
      if (body.password.length < 6) return error('Password must be at least 6 characters.', 422)
      data.passwordHash = hashPassword(body.password)
    }

    // Role, active status, branch assignment
    if (isAdmin || isBranchManager) {
      if (body.role !== undefined) {
        // BM cannot promote someone to Admin
        if (isBranchManager && body.role === ROLE_ADMIN) {
          return error('Branch managers cannot assign Administrator role.', 403)
        }
        data.role = body.role
      }
      if (body.active !== undefined) data.active = !!body.active
    }

    if (isAdmin) {
      if (body.branchId !== undefined) {
        data.branchId = body.branchId && body.branchId !== 'NONE' ? body.branchId.toString().trim() : null
      }
    } else if (isBranchManager && !existing.branchId && user.branchId) {
      // If employee currently has no branch, BM can bind them to their own branch
      data.branchId = user.branchId
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        employeeCode: true,
        phone: true,
        active: true,
        branchId: true,
        branch: { select: { id: true, branchCode: true, name: true } },
      },
    })

    await logAudit({
      user,
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      oldValue: { name: existing.name, role: existing.role, active: existing.active, branchId: existing.branchId },
      newValue: data,
    })

    return json(updated)
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Only an Administrator can delete employee accounts.', 403)
    }

    const { id } = await ctx.params
    if (user.id === id) {
      return error('You cannot delete your own logged-in administrator account.', 422)
    }

    const existing = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            collections: true,
            customers: true,
            accounts: true,
            groups: true,
          },
        },
      },
    })

    if (!existing) return error('Employee not found.', 404)

    const linkedRecords =
      existing._count.collections +
      existing._count.customers +
      existing._count.accounts +
      existing._count.groups

    if (linkedRecords > 0) {
      // If employee has transaction or account history, deactivate instead of hard delete to preserve financial audits
      await db.user.update({
        where: { id },
        data: { active: false },
      })

      await logAudit({
        user,
        action: 'EMPLOYEE_DEACTIVATED',
        entity: 'USER',
        entityId: id,
        oldValue: { active: true },
        newValue: { active: false },
        reason: 'Deactivated due to existing financial audit history.',
      })

      return json({
        success: true,
        deactivated: true,
        message: 'Employee has linked historical transactions and has been deactivated instead of deleted.',
      })
    }

    // Safely delete sessions and employee record
    await db.$transaction([
      db.session.deleteMany({ where: { userId: id } }),
      db.user.delete({ where: { id } }),
    ])

    await logAudit({
      user,
      action: 'EMPLOYEE_DELETED',
      entity: 'USER',
      entityId: id,
      oldValue: { email: existing.email, name: existing.name, role: existing.role },
    })

    return json({ success: true, message: 'Employee deleted successfully.' })
  })
}
