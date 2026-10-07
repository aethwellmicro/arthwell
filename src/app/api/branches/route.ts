import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { ROLE_ADMIN } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ensureDefaultBranch, getBranchFilter } from '@/lib/branch'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    await ensureDefaultBranch()

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const status = searchParams.get('status') || undefined

    const where: any = { ...getBranchFilter(user, undefined, 'id') }
    if (status && status !== 'ALL') where.status = status
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { branchCode: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ]
    }

    const branches = await db.branch.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, email: true, phone: true } },
        _count: {
          select: {
            users: true,
            groups: true,
            customers: true,
            accounts: true,
            collections: true,
            investments: true,
            expenses: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return json({ items: branches })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Only Administrator can add or manage branches.', 403)
    }

    const body = await parseBody(req)
    const name = (body.name || '').toString().trim()
    let branchCode = (body.branchCode || '').toString().trim().toUpperCase()
    const city = (body.city || '').toString().trim() || null
    const state = (body.state || 'Maharashtra').toString().trim() || null
    const address = (body.address || '').toString().trim() || null
    const phone = (body.phone || '').toString().trim() || null
    const email = (body.email || '').toString().trim().toLowerCase() || null
    const managerId = body.managerId ? body.managerId.toString().trim() : null

    if (!name) return error('Branch name is required.', 422)

    // Auto-generate branch code if not provided
    if (!branchCode) {
      const count = await db.branch.count()
      branchCode = `BR-${String(count + 1).padStart(4, '0')}`
    }

    const existingCode = await db.branch.findUnique({ where: { branchCode } })
    if (existingCode) return error(`Branch code ${branchCode} already exists.`, 409)

    const existingName = await db.branch.findUnique({ where: { name } })
    if (existingName) return error(`Branch name "${name}" already exists.`, 409)

    const branch = await db.branch.create({
      data: {
        branchCode,
        name,
        city,
        state,
        address,
        phone,
        email,
        managerId,
        createdById: user.id,
        status: 'ACTIVE',
      },
      include: {
        manager: { select: { id: true, name: true } },
      },
    })

    if (managerId) {
      await db.user.update({
        where: { id: managerId },
        data: { branchId: branch.id },
      }).catch(() => {})
    }

    await logAudit({
      user,
      action: 'BRANCH_CREATED',
      entity: 'BRANCH',
      entityId: branch.id,
      newValue: { branchCode, name, city },
    })

    return json({ branch }, 201)
  })
}
