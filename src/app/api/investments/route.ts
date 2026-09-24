import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate } from '@/lib/business-date'
import { logAudit } from '@/lib/audit'
import { num, parseCalendarDate } from '@/lib/calc'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'ALL'
    const status = searchParams.get('status') || 'ALL'
    const q = searchParams.get('q') || ''
    const businessDateStr = searchParams.get('businessDate')

    let whereClause: any = {}
    if (type !== 'ALL') whereClause.investmentType = type
    if (status !== 'ALL') whereClause.status = status
    if (businessDateStr) {
      const bDate = await db.businessDate.findFirst({
        where: {
          businessDate: {
            gte: new Date(businessDateStr + 'T00:00:00.000Z'),
            lte: new Date(businessDateStr + 'T23:59:59.999Z'),
          },
        },
      })
      if (bDate) whereClause.businessDateId = bDate.id
    }

    if (q) {
      whereClause.OR = [
        { investmentNumber: { contains: q, mode: 'insensitive' } },
        { investorName: { contains: q, mode: 'insensitive' } },
        { investorPhone: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
      ]
    }

    const items = await db.investment.findMany({
      where: whereClause,
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { investmentDate: 'desc' },
      take: 200,
    })

    const totalActiveAmount = items
      .filter((i) => i.status === 'ACTIVE')
      .reduce((sum, i) => sum + num(i.amount), 0)

    const totalInterestPaid = items.reduce((sum, i) => sum + num(i.interestPaid), 0)

    return json({
      items: items.map((i) => ({
        ...i,
        amount: num(i.amount),
        interestRate: i.interestRate ? num(i.interestRate) : null,
        interestPaid: num(i.interestPaid),
        investmentDate: i.investmentDate.toISOString().slice(0, 10),
        maturityDate: i.maturityDate ? i.maturityDate.toISOString().slice(0, 10) : null,
        businessDate: i.businessDate.businessDate.toISOString().slice(0, 10),
      })),
      summary: {
        count: items.length,
        totalActiveAmount,
        totalInterestPaid,
      },
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const investorName = body.investorName ? String(body.investorName).trim() : ''
    const investorPhone = body.investorPhone ? String(body.investorPhone).trim() : null
    const investmentType = body.investmentType ? String(body.investmentType).trim() : 'INVESTOR_DEPOSIT'
    const amount = parseFloat(body.amount)
    const paymentMode = body.paymentMode ? String(body.paymentMode).trim().toUpperCase() : 'CASH'
    const investmentDate = body.investmentDate ? parseCalendarDate(body.investmentDate) : parseCalendarDate(new Date())
    const termMonths = body.termMonths ? parseInt(body.termMonths) : null
    const interestRate = body.interestRate !== undefined && body.interestRate !== '' ? parseFloat(body.interestRate) : null
    const remarks = body.remarks ? String(body.remarks).trim() : null

    if (!investorName) {
      return error('Investor name is required.', 422)
    }
    if (isNaN(amount) || amount <= 0) {
      return error('Valid positive investment amount is required.', 422)
    }

    // Determine active business date
    const activeBDate = await getActiveBusinessDate(user)
    if (!activeBDate) {
      return error('No active business date is open. Please establish a business date first.', 422)
    }

    // Auto-calculate maturity date if termMonths is provided
    let maturityDate: Date | null = null
    if (termMonths && termMonths > 0) {
      const d = new Date(investmentDate.getTime())
      d.setMonth(d.getMonth() + termMonths)
      maturityDate = parseCalendarDate(d)
    } else if (body.maturityDate) {
      maturityDate = parseCalendarDate(body.maturityDate)
    }

    // Auto-generate investment number (INV-0001)
    const count = await db.investment.count()
    const investmentNumber = `INV-${String(count + 1).padStart(4, '0')}`

    const investment = await db.investment.create({
      data: {
        investmentNumber,
        businessDateId: activeBDate.id,
        investorName,
        investorPhone,
        investmentType,
        amount,
        paymentMode,
        investmentDate,
        termMonths,
        interestRate,
        maturityDate,
        interestPaid: 0,
        status: 'ACTIVE',
        remarks,
        createdById: user.id,
      },
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { name: true } },
      },
    })

    await logAudit({
      user,
      action: 'INVESTMENT_RECORDED',
      entity: 'INVESTMENT',
      entityId: investment.id,
      newValue: {
        investmentNumber,
        investorName,
        amount,
        paymentMode,
        investmentType,
      },
      reason: `Recorded investment ${investmentNumber} from ${investorName} (${paymentMode})`,
    })

    return json(
      {
        success: true,
        message: `Investment ${investmentNumber} of ₹${amount.toLocaleString('en-IN')} recorded successfully and credited to ${paymentMode === 'CASH' ? 'Cash Balance' : 'Bank Balance'}.`,
        item: {
          ...investment,
          amount: num(investment.amount),
          interestRate: investment.interestRate ? num(investment.interestRate) : null,
          interestPaid: num(investment.interestPaid),
          investmentDate: investment.investmentDate.toISOString().slice(0, 10),
          maturityDate: investment.maturityDate ? investment.maturityDate.toISOString().slice(0, 10) : null,
          businessDate: investment.businessDate.businessDate.toISOString().slice(0, 10),
        },
      },
      201
    )
  })
}
