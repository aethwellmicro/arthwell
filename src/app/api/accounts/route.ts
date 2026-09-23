import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { calculateLoan, parseCalendarDate, type InterestType, type InterestPeriod, type InstallmentFreq } from '@/lib/calc'
import { getActiveBusinessDate, assertBusinessDateOpen } from '@/lib/business-date'
import { z } from 'zod'

const accountSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  principal: z.coerce.number().positive('Principal must be greater than 0'),
  interestRate: z.coerce.number().min(0, 'Valid interest rate is required'),
  interestType: z.enum(['FLAT', 'REDUCING'], { message: 'Invalid interest type' }),
  interestPeriod: z.enum(['MONTHLY', 'YEARLY', 'FLAT_PERIOD'], { message: 'Invalid interest period' }),
  tenure: z.coerce.number().int().positive('Tenure must be greater than 0'),
  installmentFreq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'], { message: 'Invalid installment frequency' }),
  startDate: z.string().min(1, 'Start date is required').refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  remarks: z.string().max(500).optional().nullable(),
})

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const status = searchParams.get('status') || undefined
    const customerId = searchParams.get('customerId') || undefined
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}
    if (status) where.status = status
    if (customerId) where.customerId = customerId
    if (q) {
      const or: any[] = [{ accountNumber: { contains: q } }]
      where.OR = or
      // also match by customer name/mobile via relation
      where.customer = {
        OR: [{ fullName: { contains: q } }, { primaryMobile: { contains: q } }, { customerId: { contains: q } }],
      }
    }

    const accounts = await db.account.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const accountIds = accounts.map((a) => a.id)

    const collectionsStats = await db.collection.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accountIds }, status: 'SUCCESSFUL' },
      _sum: { amount: true },
    })

    const overdueInstallments = await db.installment.findMany({
      where: { accountId: { in: accountIds }, dueDate: { lt: new Date() }, status: 'PENDING' },
      select: { accountId: true, amount: true, paidAmount: true },
    })

    // To get the next due installment we can fetch all PENDING/PARTIAL, order by dueDate, and pick the first per account
    const pendingInstallments = await db.installment.findMany({
      where: { accountId: { in: accountIds }, status: { in: ['PENDING', 'PARTIAL'] } },
      orderBy: { dueDate: 'asc' },
      select: { accountId: true, dueDate: true, amount: true, paidAmount: true },
    })

    const enriched = accounts.map((a) => {
      const cStats = collectionsStats.find((s) => s.accountId === a.id)
      const paid = Number(cStats?._sum?.amount || 0)
      const totalPayable = Number(a.totalPayable)
      const outstanding = Math.max(totalPayable - paid, 0)
      const progressPercent = totalPayable > 0 ? Math.min(Math.round((paid / totalPayable) * 100), 100) : 0

      const accOverdue = overdueInstallments.filter((i) => i.accountId === a.id)
      const overdueAmount = accOverdue.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount)), 0)

      const nextDue = pendingInstallments.find((i) => i.accountId === a.id)

      return {
        ...a,
        principal: Number(a.principal),
        interestRate: Number(a.interestRate),
        installmentAmount: Number(a.installmentAmount),
        totalPayable,
        totalInterest: Number(a.totalInterest),
        paidAmount: paid,
        outstanding,
        overdueAmount,
        progressPercent,
        nextDueDate: nextDue?.dueDate || null,
      }
    })

    return json({ items: enriched })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const result = accountSchema.safeParse(body)
    if (!result.success) {
      return error(result.error.issues[0].message, 422)
    }
    const data = result.data

    const customer = await db.customer.findUnique({
      where: { id: data.customerId },
      include: { group: true },
    })
    if (!customer) return error('Customer not found.', 404)

    // Critical Disbursement Gate:
    // 1. Customer must not be cancelled
    if (customer.status === 'CANCELLED') {
      return error('Cannot disburse loan to a cancelled customer.', 422)
    }

    // 2. Customer must be approved by Branch Manager / Admin (or legacy ACTIVE)
    if (customer.status === 'PENDING_VERIFICATION') {
      return error('Customer must be approved by the Branch Manager before disbursement.', 422)
    }

    if (customer.status === 'REJECTED') {
      return error('Customer application was rejected and cannot be disbursed. Re-verify or resubmit the customer first.', 422)
    }

    if (customer.status !== 'APPROVED' && customer.status !== 'READY_FOR_DISBURSEMENT' && customer.status !== 'ACTIVE') {
      return error(`Customer is in "${customer.status}" status and is not eligible for disbursement.`, 422)
    }

    const activeBDate = await getActiveBusinessDate(user)
    if (!activeBDate) {
      return error('No active business date found. Please initialize a business date first.', 422)
    }
    await assertBusinessDateOpen(activeBDate.id)

    const startDate = parseCalendarDate(data.startDate)
    const computed = calculateLoan({
      principal: data.principal,
      interestRate: data.interestRate,
      interestType: data.interestType,
      interestPeriod: data.interestPeriod,
      tenure: data.tenure,
      installmentFreq: data.installmentFreq,
      startDate,
    })

    const prefix = 'LN'
    const account = await db.$transaction(async (tx) => {
      const last = await tx.account.findFirst({ orderBy: { createdAt: 'desc' } })
      let nextN = 0
      if (last && last.accountNumber) {
        const m = last.accountNumber.match(/(\d+)$/)
        if (m) nextN = parseInt(m[1])
      }
      const accountNumber = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

      const newAccount = await tx.account.create({
        data: {
          accountNumber,
          customerId: data.customerId,
          businessDateId: activeBDate.id,
          principal: computed.principal,
          interestRate: data.interestRate,
          interestType: data.interestType,
          interestPeriod: data.interestPeriod,
          tenure: data.tenure,
          installmentFreq: data.installmentFreq,
          installmentAmount: computed.installmentAmount,
          totalPayable: computed.totalPayable,
          totalInterest: computed.totalInterest,
          startDate,
          firstDueDate: computed.firstDueDate,
          maturityDate: computed.maturityDate,
          status: 'ACTIVE',
          remarks: data.remarks || null,
          createdById: user.id,
        },
      })

      await tx.installment.createMany({
        data: computed.schedule.map((s) => ({
          accountId: newAccount.id,
          installNo: s.installNo,
          dueDate: s.dueDate,
          amount: s.amount,
          principalPart: s.principalPart,
          interestPart: s.interestPart,
          balance: s.balance,
          status: 'PENDING',
        })),
      })

      // Update customer status to DISBURSED atomically
      await tx.customer.update({
        where: { id: customer.id },
        data: { status: 'DISBURSED' },
      })

      return newAccount
    })

    await logAudit({
      user,
      action: 'CUSTOMER_DISBURSED',
      entity: 'CUSTOMER',
      entityId: customer.id,
      oldValue: { status: customer.status },
      newValue: { status: 'DISBURSED', accountNumber: account.accountNumber, principal: computed.principal },
    })

    await logAudit({
      user,
      action: 'CREATE',
      entity: 'ACCOUNT',
      entityId: account.id,
      newValue: { accountNumber: account.accountNumber, customerId: data.customerId, principal: computed.principal, totalPayable: computed.totalPayable },
    })
    return json({ ...account, principal: Number(account.principal), totalPayable: Number(account.totalPayable), totalInterest: Number(account.totalInterest), installmentAmount: Number(account.installmentAmount) }, 201)
  })
}
