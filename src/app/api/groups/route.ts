import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  branch: z.string().max(100).default('Main Branch'),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CLOSED']).default('ACTIVE'),
})

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || undefined
    const branch = searchParams.get('branch') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { groupId: { contains: q, mode: 'insensitive' } },
        { branch: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'ALL') where.status = status
    if (branch && branch !== 'ALL') where.branch = branch

    const [items, total] = await Promise.all([
      db.group.findMany({
        where,
        include: {
          _count: { select: { customers: true } },
          createdBy: { select: { id: true, name: true, role: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.group.count({ where }),
    ])

    return json({ items, total })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const result = groupSchema.safeParse(body)
    if (!result.success) {
      return error(result.error.issues[0].message, 422)
    }
    const data = result.data

    const trimmedName = data.name.trim()
    const branch = (data.branch || 'Main Branch').trim()

    // Duplicate check within the branch
    const existing = await db.group.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
        branch: { equals: branch, mode: 'insensitive' },
      },
    })
    if (existing) {
      return error(`A group with the name "${trimmedName}" already exists in ${branch}.`, 409)
    }

    // Sequence-safe Group ID generation
    const prefix = 'GRP'
    const group = await db.$transaction(async (tx) => {
      const last = await tx.group.findFirst({ orderBy: { createdAt: 'desc' } })
      let nextN = 0
      if (last && last.groupId) {
        const m = last.groupId.match(/(\d+)$/)
        if (m) nextN = parseInt(m[1])
      }
      const groupId = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

      return tx.group.create({
        data: {
          groupId,
          name: trimmedName,
          branch,
          description: data.description?.trim() || null,
          status: data.status,
          createdById: user.id,
        },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          _count: { select: { customers: true } },
        },
      })
    })

    await logAudit({
      user,
      action: 'GROUP_CREATED',
      entity: 'GROUP',
      entityId: group.id,
      newValue: { groupId: group.groupId, name: group.name, branch: group.branch },
    })

    return json(group, 201)
  })
}
