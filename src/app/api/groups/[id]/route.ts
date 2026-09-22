import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { z } from 'zod'

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  branch: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CLOSED']).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const group = await db.group.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true, email: true } },
        customers: {
          include: {
            createdBy: { select: { id: true, name: true } },
            accounts: { select: { id: true, accountNumber: true, status: true, totalPayable: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { customers: true } },
      },
    })
    if (!group) return error('Group not found.', 404)
    return json(group)
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const result = updateGroupSchema.safeParse(body)
    if (!result.success) {
      return error(result.error.issues[0].message, 422)
    }

    const existing = await db.group.findUnique({ where: { id } })
    if (!existing) return error('Group not found.', 404)

    const data: any = {}
    if (result.data.name) data.name = result.data.name.trim()
    if (result.data.branch) data.branch = result.data.branch.trim()
    if (result.data.description !== undefined) data.description = result.data.description?.trim() || null
    if (result.data.status) data.status = result.data.status

    if (data.name && data.name !== existing.name) {
      const branchCheck = data.branch || existing.branch
      const duplicate = await db.group.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name, mode: 'insensitive' },
          branch: { equals: branchCheck, mode: 'insensitive' },
        },
      })
      if (duplicate) {
        return error(`A group named "${data.name}" already exists in ${branchCheck}.`, 409)
      }
    }

    const updated = await db.group.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { customers: true } },
      },
    })

    await logAudit({
      user,
      action: 'GROUP_UPDATED',
      entity: 'GROUP',
      entityId: id,
      oldValue: { name: existing.name, status: existing.status, branch: existing.branch },
      newValue: data,
    })

    return json(updated)
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const existing = await db.group.findUnique({
      where: { id },
      include: { _count: { select: { customers: true } } },
    })
    if (!existing) return error('Group not found.', 404)

    // Authorization check: Admin, Branch Manager, or creator
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER && user.id !== existing.createdById) {
      return error('Unauthorized to delete this group.', 403)
    }

    // Safety check: Cannot delete group with assigned customers
    if (existing._count.customers > 0) {
      return error('Cannot delete group while customers are assigned to it. Reassign or remove customers first.', 422)
    }

    await db.group.delete({ where: { id } })

    await logAudit({
      user,
      action: 'GROUP_DELETED',
      entity: 'GROUP',
      entityId: id,
      oldValue: { groupId: existing.groupId, name: existing.name, branch: existing.branch },
    })

    return json({ success: true, message: 'Group deleted successfully.' })
  })
}
