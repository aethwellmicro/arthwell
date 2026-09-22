import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const customerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  primaryMobile: z.string().min(10, 'Valid primary mobile number is required').max(15),
  alternateMobile: z.string().max(15).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  referenceName: z.string().max(100).optional().nullable(),
  referenceMobile: z.string().max(15).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
  idType: z.string().max(50).optional().nullable(),
  idNumber: z.string().max(50).optional().nullable(),
  amount: z.coerce.number().min(0).default(0),
  groupId: z.string().min(1, 'Please select a valid group.').optional().nullable(),
  branch: z.string().max(100).default('Main Branch'),
})

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || undefined
    const area = searchParams.get('area') || undefined
    const groupId = searchParams.get('groupId') || undefined
    const branch = searchParams.get('branch') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { primaryMobile: { contains: q, mode: 'insensitive' } },
        { customerId: { contains: q, mode: 'insensitive' } },
        { alternateMobile: { contains: q, mode: 'insensitive' } },
        { group: { name: { contains: q, mode: 'insensitive' } } },
        { group: { groupId: { contains: q, mode: 'insensitive' } } },
      ]
    }
    if (status && status !== 'ALL') where.status = status
    if (area) where.area = { contains: area, mode: 'insensitive' }
    if (groupId && groupId !== 'ALL') where.groupId = groupId
    if (branch && branch !== 'ALL') where.branch = branch

    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          group: { select: { id: true, groupId: true, name: true, branch: true } },
          _count: { select: { accounts: true, collections: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.customer.count({ where }),
    ])

    const customerIds = items.map((c) => c.id)

    const accountsData = await db.account.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true, totalPayable: true, status: true },
    })

    const collectionsStats = await db.collection.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: 'SUCCESSFUL' },
      _sum: { amount: true },
      _max: { collectionDate: true },
    })

    const enriched = items.map((c) => {
      const cAccounts = accountsData.filter((a) => a.customerId === c.id)
      const cStats = collectionsStats.find((s) => s.customerId === c.id)

      const totalPayable = cAccounts.reduce((s, a) => s + Number(a.totalPayable), 0)
      const totalCollected = Number(cStats?._sum?.amount || 0)
      const lastPaymentDate = cStats?._max?.collectionDate || null

      return {
        ...c,
        totalPayable,
        totalCollected,
        outstanding: Math.max(totalPayable - totalCollected, 0),
        lastPaymentDate,
      }
    })

    return json({ items: enriched, total })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const result = customerSchema.safeParse(body)
    if (!result.success) {
      return error(result.error.issues[0].message, 422)
    }
    const data = result.data

    // Group validation: Group is required for new customer creation
    if (!data.groupId) {
      return error('Please select a group for this customer.', 422)
    }

    const group = await db.group.findUnique({ where: { id: data.groupId } })
    if (!group) {
      return error('Selected group does not exist.', 404)
    }
    if (group.status !== 'ACTIVE') {
      return error(`Cannot assign customer to ${group.status.toLowerCase()} group "${group.name}".`, 422)
    }

    // Duplicate check on primaryMobile
    const existingMobile = await db.customer.findFirst({
      where: { primaryMobile: data.primaryMobile.trim() },
    })
    if (existingMobile) {
      return error(`A customer with mobile number ${data.primaryMobile.trim()} is already registered (${existingMobile.fullName} - ${existingMobile.customerId}).`, 409)
    }

    const branch = group.branch || data.branch || 'Main Branch'

    // Initial status: PENDING_VERIFICATION for Field Officers
    // Admins/Branch Managers can optionally create pre-approved customers
    const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'BRANCH_MANAGER'
    const initialStatus = isManagerOrAdmin && body.preApprove === true ? 'APPROVED' : 'PENDING_VERIFICATION'

    const prefix = 'CUST'
    const customer = await db.$transaction(async (tx) => {
      const last = await tx.customer.findFirst({ orderBy: { createdAt: 'desc' } })
      let nextN = 0
      if (last && last.customerId) {
        const m = last.customerId.match(/(\d+)$/)
        if (m) nextN = parseInt(m[1])
      }
      const customerId = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

      return tx.customer.create({
        data: {
          customerId,
          fullName: data.fullName.trim(),
          primaryMobile: data.primaryMobile.trim(),
          alternateMobile: data.alternateMobile || null,
          address: data.address || null,
          city: data.city || null,
          area: data.area || null,
          occupation: data.occupation || null,
          referenceName: data.referenceName || null,
          referenceMobile: data.referenceMobile || null,
          photoUrl: data.photoUrl || null,
          idType: data.idType || null,
          idNumber: data.idNumber || null,
          amount: data.amount,
          branch,
          groupId: group.id,
          status: initialStatus,
          approvedById: initialStatus === 'APPROVED' ? user.id : null,
          approvedAt: initialStatus === 'APPROVED' ? new Date() : null,
          createdById: user.id,
        },
        include: {
          group: { select: { id: true, groupId: true, name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      })
    })

    await logAudit({
      user,
      action: 'CUSTOMER_CREATED',
      entity: 'CUSTOMER',
      entityId: customer.id,
      newValue: {
        customerId: customer.customerId,
        fullName: customer.fullName,
        primaryMobile: customer.primaryMobile,
        groupId: customer.groupId,
        groupName: group.name,
        status: customer.status,
      },
    })

    return json(customer, 201)
  })
}
