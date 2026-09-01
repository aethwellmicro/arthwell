import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { hashPassword, ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') || undefined
    const employees = await db.user.findMany({
      where: role ? { role } : undefined,
      select: { id: true, email: true, name: true, role: true, employeeCode: true, phone: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    // enrich with collection stats
    const enriched = await Promise.all(
      employees.map(async (e) => {
        const agg = await db.collection.aggregate({ where: { collectedById: e.id, status: 'SUCCESSFUL' }, _sum: { amount: true } })
        const count = await db.collection.count({ where: { collectedById: e.id, status: 'SUCCESSFUL' } })
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const todayAgg = await db.collection.aggregate({ where: { collectedById: e.id, status: 'SUCCESSFUL', collectionDate: { gte: todayStart } }, _sum: { amount: true } })
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)
        const weekAgg = await db.collection.aggregate({ where: { collectedById: e.id, status: 'SUCCESSFUL', collectionDate: { gte: weekStart } }, _sum: { amount: true } })
        return {
          ...e,
          totalCollected: Number(agg._sum.amount || 0),
          transactionCount: count,
          todayCollected: Number(todayAgg._sum.amount || 0),
          weekCollected: Number(weekAgg._sum.amount || 0),
        }
      })
    )
    return json({ items: enriched })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Only Admin or Branch Manager can create employee accounts.', 403)
    }
    const body = await parseBody(req)
    const email = (body.email || '').toString().trim().toLowerCase()
    const name = (body.name || '').toString().trim()
    const password = (body.password || '').toString()
    const role = (body.role || 'COLLECTION_EMPLOYEE').toString()
    const employeeCode = (body.employeeCode || '').toString().trim() || null
    const phone = (body.phone || '').toString().trim() || null

    if (!email || !name || !password) return error('Email, name and password are required.', 422)
    if (!['ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'COLLECTION_EMPLOYEE'].includes(role)) return error('Invalid role.', 422)
    if (password.length < 6) return error('Password must be at least 6 characters.', 422)

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return error('Email already in use.', 409)

    const created = await db.user.create({
      data: { email, name, passwordHash: hashPassword(password), role, employeeCode, phone },
      select: { id: true, email: true, name: true, role: true, employeeCode: true, phone: true, active: true, createdAt: true },
    })
    await logAudit({ user, action: 'CREATE', entity: 'USER', entityId: created.id, newValue: { email, name, role } })
    return json(created, 201)
  })
}
