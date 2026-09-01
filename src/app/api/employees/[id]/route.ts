import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { hashPassword, ROLE_ADMIN } from '@/lib/auth'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await parseBody(req)
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return error('Employee not found.', 404)

    // only admin or self (self can't change role/active)
    const isSelf = user.id === id
    const isAdmin = user.role === ROLE_ADMIN
    if (!isSelf && !isAdmin) return error('Not authorized to edit this employee.', 403)

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.phone !== undefined) data.phone = body.phone || null
    if (body.employeeCode !== undefined) data.employeeCode = body.employeeCode || null
    if (body.password) {
      if (body.password.length < 6) return error('Password must be at least 6 characters.', 422)
      data.passwordHash = hashPassword(body.password)
    }
    if (isAdmin) {
      if (body.role !== undefined) data.role = body.role
      if (body.active !== undefined) data.active = !!body.active
    }

    const updated = await db.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, employeeCode: true, phone: true, active: true } })
    await logAudit({ user, action: 'UPDATE', entity: 'USER', entityId: id, oldValue: { name: existing.name, role: existing.role, active: existing.active }, newValue: data })
    return json(updated)
  })
}
