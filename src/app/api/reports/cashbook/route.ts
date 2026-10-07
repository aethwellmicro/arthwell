import { db } from '@/lib/db'
import { json, withAuth } from '@/lib/api'
import { num } from '@/lib/calc'
import { getBranchFilter } from '@/lib/branch'

/**
 * GET /api/reports/cashbook
 * Returns a full Cash Book with opening balance, all daily Dr/Cr entries, and running balance.
 * Supports optional ?from=YYYY-MM-DD&to=YYYY-MM-DD date range filters.
 */
export async function GET(req: Request) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const requestedBranchId = searchParams.get('branchId') || undefined
    const branchFilter = getBranchFilter(user, requestedBranchId)

    const dateFrom = from ? new Date(from + 'T00:00:00.000') : undefined
    const dateTo = to ? new Date(to + 'T23:59:59.999') : undefined

    const dateRange: any = {}
    if (dateFrom) dateRange.gte = dateFrom
    if (dateTo) dateRange.lte = dateTo

    // 1. Business dates in range
    const businessDates = await db.businessDate.findMany({
      where: {
        ...(dateFrom || dateTo
          ? { businessDate: dateRange }
          : {}),
        ...branchFilter,
      },
      orderBy: { businessDate: 'asc' },
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
    })

    // 2. Cash entries — all approved collections (CASH mode)
    const collections = await db.collection.findMany({
      where: {
        status: { in: ['APPROVED', 'SUCCESSFUL'] },
        paymentMode: 'CASH',
        ...(dateFrom || dateTo ? { collectionDate: dateRange } : {}),
        ...branchFilter,
      },
      include: {
        customer: { select: { fullName: true, customerId: true } },
        account: { select: { accountNumber: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { collectionDate: 'asc' },
    })

    // 3. Loan disbursements (CASH outflows)
    const disbursements = await db.account.findMany({
      where: {
        status: { not: 'CANCELLED' },
        ...(dateFrom || dateTo ? { startDate: dateRange } : {}),
        ...branchFilter,
      },
      include: {
        customer: { select: { fullName: true, customerId: true } },
      },
      orderBy: { startDate: 'asc' },
    })

    // 4. Cash expenses (outflows)
    const expenses = await db.expense.findMany({
      where: {
        status: { not: 'CANCELLED' },
        paymentMode: 'CASH',
        ...(dateFrom || dateTo ? { expenseDate: dateRange } : {}),
        ...branchFilter,
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: { expenseDate: 'asc' },
    })

    // 5. Bank deposits (cash transferred to bank — outflow from vault)
    const bankDeposits = await db.bankDeposit.findMany({
      where: {
        ...(dateFrom || dateTo ? { depositDate: dateRange } : {}),
        ...branchFilter,
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: { depositDate: 'asc' },
    })

    // 6. Cash investments (inflows)
    const investments = await db.investment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        paymentMode: 'CASH',
        ...(dateFrom || dateTo ? { investmentDate: dateRange } : {}),
        ...branchFilter,
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: { investmentDate: 'asc' },
    })

    // Build flat ledger entries
    type CashEntry = {
      date: string
      particulars: string
      voucherNo: string
      narration: string
      debit: number
      credit: number
      type: string
    }

    const entries: CashEntry[] = []

    // Collections = CREDIT (cash received)
    for (const c of collections) {
      entries.push({
        date: c.collectionDate.toISOString().slice(0, 10),
        particulars: `${c.customer.fullName} (${c.customer.customerId})`,
        voucherNo: c.receiptNumber,
        narration: `EMI Collection — Loan ${c.account.accountNumber} by ${c.collectedBy.name}`,
        debit: num(c.amount),
        credit: 0,
        type: 'COLLECTION',
      })
    }

    // Investments = CREDIT (cash received into vault)
    for (const inv of investments) {
      entries.push({
        date: inv.investmentDate.toISOString().slice(0, 10),
        particulars: inv.investorName,
        voucherNo: inv.investmentNumber,
        narration: `Investment received — ${inv.investmentType}`,
        debit: num(inv.amount),
        credit: 0,
        type: 'INVESTMENT',
      })
    }

    // Disbursements = DEBIT (cash paid out)
    for (const d of disbursements) {
      const recoveredCharges = num(d.processingFee) + num(d.insurancePremium)
      entries.push({
        date: d.startDate.toISOString().slice(0, 10),
        particulars: `${d.customer.fullName} (${d.customer.customerId})`,
        voucherNo: d.accountNumber,
        narration: `Loan disbursement — Principal ₹${num(d.principal).toFixed(2)}`,
        debit: 0,
        credit: num(d.principal),
        type: 'DISBURSEMENT',
      })
      if (recoveredCharges > 0) {
        entries.push({
          date: d.startDate.toISOString().slice(0, 10),
          particulars: `${d.customer.fullName} (${d.customer.customerId})`,
          voucherNo: `CHG-${d.accountNumber.slice(-4)}`,
          narration: `Recovered processing fee and insurance — ₹${recoveredCharges.toFixed(2)}`,
          debit: recoveredCharges,
          credit: 0,
          type: 'CHARGE_RECOVERY',
        })
      }
    }

    // Expenses = DEBIT (cash paid out)
    for (const e of expenses) {
      entries.push({
        date: e.expenseDate.toISOString().slice(0, 10),
        particulars: e.expenseType.replace(/_/g, ' '),
        voucherNo: e.expenseNumber,
        narration: `${e.particulars}${e.recipientName ? ` — ${e.recipientName}` : ''}`,
        debit: 0,
        credit: num(e.amount),
        type: 'EXPENSE',
      })
    }

    // Bank Deposits = DEBIT (cash moved from vault to bank)
    for (const bd of bankDeposits) {
      entries.push({
        date: bd.depositDate.toISOString().slice(0, 10),
        particulars: `Bank: ${bd.bankAccount}`,
        voucherNo: bd.depositNumber,
        narration: `Cash deposited to bank${bd.referenceNumber ? ` — Ref: ${bd.referenceNumber}` : ''}`,
        debit: 0,
        credit: num(bd.amount),
        type: 'BANK_DEPOSIT',
      })
    }

    // Sort all entries chronologically
    entries.sort((a, b) => a.date.localeCompare(b.date))

    // Calculate opening balance from closed business dates before the range
    let openingBalance = 0
    if (dateFrom) {
      const priorClosed = await db.businessDate.findFirst({
        where: {
          businessDate: { lt: dateFrom },
          status: 'CLOSED',
          ...branchFilter,
        },
        orderBy: { businessDate: 'desc' },
      })
      if (priorClosed) {
        openingBalance = num(priorClosed.closingCash)
      }
    } else {
      // Use first business date opening cash
      const firstDate = await db.businessDate.findFirst({
        where: { ...branchFilter },
        orderBy: { businessDate: 'asc' },
      })
      if (firstDate) {
        openingBalance = num(firstDate.openingCash)
      }
    }

    // Add running balance to entries
    let runningBalance = openingBalance
    const ledger = entries.map((e) => {
      runningBalance = runningBalance + e.debit - e.credit
      return { ...e, balance: Math.max(0, runningBalance) }
    })

    // Totals
    const totalDebits = entries.reduce((s, e) => s + e.debit, 0)
    const totalCredits = entries.reduce((s, e) => s + e.credit, 0)
    const closingBalance = openingBalance + totalDebits - totalCredits

    // EOD summary per business date
    const eodSummary = businessDates.map((bd) => ({
      id: bd.id,
      businessDate: bd.businessDate.toISOString().slice(0, 10),
      status: bd.status,
      openingCash: num(bd.openingCash),
      closingCash: num(bd.closingCash),
      actualCashInHand: num(bd.actualCashInHand),
      cashDifference: num(bd.cashDifference),
      openedBy: bd.openedBy?.name || 'System',
      closedBy: bd.closedBy?.name || null,
      reconciliationStatus: bd.reconciliationStatus,
    }))

    return json({
      reportType: 'cash-book',
      dateFrom: dateFrom?.toISOString().slice(0, 10) || null,
      dateTo: dateTo?.toISOString().slice(0, 10) || null,
      openingBalance,
      closingBalance: Math.max(0, closingBalance),
      totalDebits,
      totalCredits,
      entries: ledger,
      eodSummary,
      entryCount: ledger.length,
    })
  })
}
