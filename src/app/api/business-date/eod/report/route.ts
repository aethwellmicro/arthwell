import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { getBusinessDateSummary } from '@/lib/business-date'
import { parseCalendarDate, num } from '@/lib/calc'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')

    let bDate: any = null
    if (dateStr) {
      const parsed = parseCalendarDate(dateStr)
      bDate = await db.businessDate.findUnique({
        where: { businessDate: parsed },
      })
    } else {
      bDate = await db.businessDate.findFirst({
        where: { status: { in: ['OPEN', 'REOPENED', 'RECONCILIATION_PENDING'] } },
        orderBy: { businessDate: 'desc' },
      })
      if (!bDate) {
        bDate = await db.businessDate.findFirst({
          where: { status: 'CLOSED' },
          orderBy: { businessDate: 'desc' },
        })
      }
    }

    if (!bDate) {
      return error('No business date found.', 404)
    }

    const summary = await getBusinessDateSummary(bDate.id)

    // Detailed employee collections breakdown for this business date
    const collections = await db.collection.findMany({
      where: { businessDateId: bDate.id, status: 'SUCCESSFUL' },
      include: {
        collectedBy: { select: { id: true, name: true, employeeCode: true } },
        customer: { select: { fullName: true, customerId: true } },
        account: { select: { accountNumber: true } },
      },
      orderBy: { collectionDate: 'asc' },
    })

    const employeeMap = new Map<string, { employeeId: string; name: string; code: string; count: number; total: number; cash: number; upi: number; bank: number }>()
    for (const c of collections) {
      const empId = c.collectedById
      const amt = num(c.amount)
      let emp = employeeMap.get(empId)
      if (!emp) {
        emp = {
          employeeId: empId,
          name: c.collectedBy.name,
          code: c.collectedBy.employeeCode || '—',
          count: 0,
          total: 0,
          cash: 0,
          upi: 0,
          bank: 0,
        }
        employeeMap.set(empId, emp)
      }
      emp.count++
      emp.total += amt
      if (c.paymentMode === 'CASH') emp.cash += amt
      else if (c.paymentMode === 'UPI') emp.upi += amt
      else emp.bank += amt
    }

    // Detailed disbursements breakdown
    const accounts = await db.account.findMany({
      where: { businessDateId: bDate.id, status: { not: 'CANCELLED' } },
      include: {
        customer: { select: { fullName: true, customerId: true } },
        createdBy: { select: { name: true } },
      },
    })

    // Bank deposits breakdown
    const deposits = await db.bankDeposit.findMany({
      where: { businessDateId: bDate.id },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { depositDate: 'asc' },
    })

    // Investments breakdown
    const investments = await db.investment.findMany({
      where: { businessDateId: bDate.id, status: { not: 'CANCELLED' } },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { investmentDate: 'asc' },
    })

    // Expenses breakdown
    const expenses = await db.expense.findMany({
      where: { businessDateId: bDate.id, status: { not: 'CANCELLED' } },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { expenseDate: 'asc' },
    })

    const reportObj = {
      businessDate: bDate.businessDate.toISOString().slice(0, 10),
      status: summary.status,
      cashReconciliation: {
        openingCash: summary.openingCash,
        totalCollections: summary.cashCollections,
        otherCollections: summary.otherCollections,
        totalInvestments: summary.cashInvestments,
        totalDisbursements: summary.cashDisbursements,
        totalExpenses: summary.cashExpenses,
        bankDeposits: summary.bankDeposits,
        expectedClosingCash: summary.expectedClosingCash,
        actualClosingCash: summary.actualCashInHand,
        cashDifference: summary.cashDifference,
      },
      collectionsByEmployee: Array.from(employeeMap.values()).map((e) => ({
        employeeId: e.employeeId,
        employeeName: e.name,
        employeeCode: e.code,
        count: e.count,
        total: e.total,
        cash: e.cash,
        upi: e.upi,
        bank: e.bank,
      })),
      disbursements: accounts.map((a) => ({
        accountNumber: a.accountNumber,
        customerName: a.customer.fullName,
        customerId: a.customer.customerId,
        principal: num(a.principal),
        disbursedBy: a.createdBy.name,
      })),
      bankDepositRecords: deposits.map((d) => ({
        id: d.id,
        depositNumber: d.depositNumber,
        bankAccount: d.bankAccount,
        amount: num(d.amount),
        referenceNumber: d.referenceNumber || '—',
        depositedBy: d.createdBy.name,
      })),
      investmentRecords: investments.map((inv) => ({
        id: inv.id,
        investmentNumber: inv.investmentNumber,
        investorName: inv.investorName,
        investmentType: inv.investmentType,
        amount: num(inv.amount),
        paymentMode: inv.paymentMode,
        receivedBy: inv.createdBy.name,
      })),
      expenseRecords: expenses.map((exp) => ({
        id: exp.id,
        expenseNumber: exp.expenseNumber,
        expenseType: exp.expenseType,
        particulars: exp.particulars,
        amount: num(exp.amount),
        paymentMode: exp.paymentMode,
        spentBy: exp.createdBy.name,
      })),
      closedBy: summary.closedBy?.name || null,
      closedAt: summary.closedAt || null,
      reopenHistory: bDate.reopenedAt ? {
        reopenedAt: bDate.reopenedAt,
        reopenReason: bDate.reopenReason,
      } : null,
    }

    return json({
      report: reportObj,
      // Root-level fields for direct compatibility
      businessDate: reportObj.businessDate,
      summary,
      employees: reportObj.collectionsByEmployee,
      disbursements: reportObj.disbursements,
      bankDeposits: reportObj.bankDepositRecords,
      investments: reportObj.investmentRecords,
      expenses: reportObj.expenseRecords,
    })
  })
}
