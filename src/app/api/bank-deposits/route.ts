import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate, assertBusinessDateOpen } from '@/lib/business-date'
import { parseCalendarDate } from '@/lib/calc'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const depositSchema = z.object({
  bankAccount: z.string().min(1, 'Bank Account is required').max(100),
  amount: z.coerce.number().positive('Deposit amount must be greater than 0'),
  referenceNumber: z.string().max(100).optional().nullable(),
  depositDate: z.string().min(1, 'Deposit date is required'),
  notes: z.string().max(500).optional().nullable(),
})

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const businessDateId = searchParams.get('businessDateId') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}
    if (businessDateId) where.businessDateId = businessDateId

    const items = await db.bankDeposit.findMany({
      where,
      include: {
        businessDate: { select: { businessDate: true, status: true } },
        createdBy: { select: { id: true, name: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return json({
      items: items.map((it) => ({
        ...it,
        amount: Number(it.amount),
        depositDate: it.depositDate.toISOString().slice(0, 10),
        businessDate: it.businessDate.businessDate.toISOString().slice(0, 10),
      })),
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const parsed = depositSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues[0].message, 422)
    }
    const data = parsed.data

    const activeBDate = await getActiveBusinessDate(user)
    if (!activeBDate) {
      return error('No active business date found. Please initialize a business date first.', 422)
    }
    await assertBusinessDateOpen(activeBDate.id)

    const depositDate = parseCalendarDate(data.depositDate)

    const prefix = 'DEP'
    const deposit = await db.$transaction(async (tx) => {
      const last = await tx.bankDeposit.findFirst({ orderBy: { createdAt: 'desc' } })
      let nextN = 0
      if (last && last.depositNumber) {
        const m = last.depositNumber.match(/(\d+)$/)
        if (m) nextN = parseInt(m[1])
      }
      const depositNumber = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

      return tx.bankDeposit.create({
        data: {
          depositNumber,
          businessDateId: activeBDate.id,
          bankAccount: data.bankAccount.trim(),
          amount: data.amount,
          referenceNumber: data.referenceNumber?.trim() || null,
          depositDate,
          notes: data.notes?.trim() || null,
          createdById: user.id,
        },
        include: {
          businessDate: true,
          createdBy: { select: { id: true, name: true } },
        },
      })
    })

    await logAudit({
      user,
      action: 'BANK_DEPOSIT_RECORDED',
      entity: 'BANK_DEPOSIT',
      entityId: deposit.id,
      newValue: {
        depositNumber: deposit.depositNumber,
        amount: data.amount,
        bankAccount: data.bankAccount,
        businessDate: activeBDate.businessDate,
      },
    })

    return json({
      ...deposit,
      amount: Number(deposit.amount),
      depositDate: deposit.depositDate.toISOString().slice(0, 10),
      businessDate: deposit.businessDate.businessDate.toISOString().slice(0, 10),
    }, 201)
  })
}
