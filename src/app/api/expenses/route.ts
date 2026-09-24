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
    if (type !== 'ALL') whereClause.expenseType = type
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
        { expenseNumber: { contains: q, mode: 'insensitive' } },
        { particulars: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { voucherNumber: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
      ]
    }

    const items = await db.expense.findMany({
      where: whereClause,
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { expenseDate: 'desc' },
      take: 200,
    })

    const totalExpenseAmount = items
      .filter((e) => e.status !== 'CANCELLED')
      .reduce((sum, e) => sum + num(e.amount), 0)

    const byType: Record<string, number> = {}
    for (const e of items) {
      if (e.status !== 'CANCELLED') {
        byType[e.expenseType] = (byType[e.expenseType] || 0) + num(e.amount)
      }
    }

    return json({
      items: items.map((e) => ({
        ...e,
        amount: num(e.amount),
        expenseDate: e.expenseDate.toISOString().slice(0, 10),
        businessDate: e.businessDate.businessDate.toISOString().slice(0, 10),
      })),
      summary: {
        count: items.length,
        totalExpenseAmount,
        byType,
      },
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const expenseType = body.expenseType ? String(body.expenseType).trim() : 'OFFICE_EXPENSE'
    const particulars = body.particulars ? String(body.particulars).trim() : ''
    const amount = parseFloat(body.amount)
    const paymentMode = body.paymentMode ? String(body.paymentMode).trim().toUpperCase() : 'CASH'
    const expenseDate = body.expenseDate ? parseCalendarDate(body.expenseDate) : parseCalendarDate(new Date())
    const recipientName = body.recipientName ? String(body.recipientName).trim() : null
    const voucherNumber = body.voucherNumber ? String(body.voucherNumber).trim() : null
    const remarks = body.remarks ? String(body.remarks).trim() : null

    if (!particulars) {
      return error('Expense particulars / description is required.', 422)
    }
    if (isNaN(amount) || amount <= 0) {
      return error('Valid positive expense amount is required.', 422)
    }

    // Determine active business date
    const activeBDate = await getActiveBusinessDate(user)
    if (!activeBDate) {
      return error('No active business date is open. Please establish a business date first.', 422)
    }

    // Auto-generate expense number (EXP-0001)
    const count = await db.expense.count()
    const expenseNumber = `EXP-${String(count + 1).padStart(4, '0')}`

    const expense = await db.expense.create({
      data: {
        expenseNumber,
        businessDateId: activeBDate.id,
        expenseType,
        particulars,
        amount,
        paymentMode,
        expenseDate,
        recipientName,
        voucherNumber,
        remarks,
        status: 'CONFIRMED',
        createdById: user.id,
      },
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { name: true } },
      },
    })

    await logAudit({
      user,
      action: 'EXPENSE_RECORDED',
      entity: 'EXPENSE',
      entityId: expense.id,
      newValue: {
        expenseNumber,
        expenseType,
        particulars,
        amount,
        paymentMode,
      },
      reason: `Recorded expense ${expenseNumber}: ${particulars} (₹${amount} via ${paymentMode})`,
    })

    return json(
      {
        success: true,
        message: `Expense ${expenseNumber} of ₹${amount.toLocaleString('en-IN')} recorded successfully and debited from ${paymentMode === 'CASH' ? 'Cash Balance' : 'Bank Balance'}.`,
        item: {
          ...expense,
          amount: num(expense.amount),
          expenseDate: expense.expenseDate.toISOString().slice(0, 10),
          businessDate: expense.businessDate.businessDate.toISOString().slice(0, 10),
        },
      },
      201
    )
  })
}
