import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { calculateLoan, type InterestType, type InterestPeriod, type InstallmentFreq } from '@/lib/calc'

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

    const enriched = await Promise.all(
      accounts.map(async (a) => {
        const collected = await db.collection.aggregate({
          where: { accountId: a.id, status: 'SUCCESSFUL' },
          _sum: { amount: true },
        })
        const paid = Number(collected._sum.amount || 0)
        const totalPayable = Number(a.totalPayable)
        const outstanding = Math.max(totalPayable - paid, 0)
        // overdue: due installments with dueDate < now and not fully paid
        const overdueInstallments = await db.installment.findMany({
          where: { accountId: a.id, dueDate: { lt: new Date() }, status: 'PENDING' },
          select: { amount: true, paidAmount: true },
        })
        const overdueAmount = overdueInstallments.reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount)), 0)
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
        }
      })
    )

    return json({ items: enriched })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const customerId = (body.customerId || '').toString()
    const principal = parseFloat(body.principal)
    const interestRate = parseFloat(body.interestRate)
    const interestType = (body.interestType || '').toString() as InterestType
    const interestPeriod = (body.interestPeriod || '').toString() as InterestPeriod
    const tenure = parseInt(body.tenure)
    const installmentFreq = (body.installmentFreq || '').toString() as InstallmentFreq
    const startDateStr = (body.startDate || '').toString()

    if (!customerId) return error('Customer is required.', 422)
    if (!principal || principal <= 0) return error('Principal must be greater than 0.', 422)
    if (isNaN(interestRate) || interestRate < 0) return error('Valid interest rate is required.', 422)
    if (!['FLAT', 'REDUCING'].includes(interestType)) return error('Invalid interest type.', 422)
    if (!['MONTHLY', 'YEARLY', 'FLAT_PERIOD'].includes(interestPeriod)) return error('Invalid interest period.', 422)
    if (!tenure || tenure <= 0) return error('Tenure must be greater than 0.', 422)
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(installmentFreq)) return error('Invalid installment frequency.', 422)
    if (!startDateStr) return error('Start date is required.', 422)

    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) return error('Customer not found.', 404)
    if (customer.status !== 'ACTIVE') return error('Cannot create account for inactive/blocked customer.', 422)

    const startDate = new Date(startDateStr)
    const computed = calculateLoan({
      principal,
      interestRate,
      interestType,
      interestPeriod,
      tenure,
      installmentFreq,
      startDate,
    })

    const prefix = 'LN'
    const last = await db.account.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextN = 0
    if (last && last.accountNumber) {
      const m = last.accountNumber.match(/(\d+)$/)
      if (m) nextN = parseInt(m[1])
    }
    const accountNumber = `${prefix}-${String(nextN + 1).padStart(4, '0')}`

    const account = await db.account.create({
      data: {
        accountNumber,
        customerId,
        principal: computed.principal,
        interestRate,
        interestType,
        interestPeriod,
        tenure,
        installmentFreq,
        installmentAmount: computed.installmentAmount,
        totalPayable: computed.totalPayable,
        totalInterest: computed.totalInterest,
        startDate,
        firstDueDate: computed.firstDueDate,
        maturityDate: computed.maturityDate,
        status: 'ACTIVE',
        remarks: body.remarks || null,
        createdById: user.id,
      },
    })

    await db.installment.createMany({
      data: computed.schedule.map((s) => ({
        accountId: account.id,
        installNo: s.installNo,
        dueDate: s.dueDate,
        amount: s.amount,
        status: 'PENDING',
      })),
    })

    await logAudit({ user, action: 'CREATE', entity: 'ACCOUNT', entityId: account.id, newValue: { accountNumber, customerId, principal: computed.principal, totalPayable: computed.totalPayable } })
    return json({ ...account, principal: Number(account.principal), totalPayable: Number(account.totalPayable), totalInterest: Number(account.totalInterest), installmentAmount: Number(account.installmentAmount) }, 201)
  })
}
