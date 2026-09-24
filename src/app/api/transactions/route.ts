import { db } from '@/lib/db'
import { json, withAuth } from '@/lib/api'
import { getActiveBusinessDate } from '@/lib/business-date'
import { num } from '@/lib/calc'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'ALL' // ALL, COLLECTION, DISBURSEMENT, BANK_DEPOSIT
    const businessDateStr = searchParams.get('businessDate') || undefined
    const limit = parseInt(searchParams.get('limit') || '200')

    let targetBusinessDateId: string | undefined

    if (businessDateStr) {
      const b = await db.businessDate.findFirst({
        where: {
          businessDate: {
            gte: new Date(businessDateStr + 'T00:00:00.000Z'),
            lte: new Date(businessDateStr + 'T23:59:59.999Z'),
          },
        },
      })
      if (b) targetBusinessDateId = b.id
    }

    const txs: any[] = []

    // 1. Collections (Inflow / Credit)
    if (type === 'ALL' || type === 'COLLECTION') {
      const collections = await db.collection.findMany({
        where: targetBusinessDateId ? { businessDateId: targetBusinessDateId } : {},
        include: {
          customer: { select: { fullName: true, customerId: true, primaryMobile: true } },
          account: { select: { accountNumber: true } },
          collectedBy: { select: { name: true } },
          businessDate: { select: { businessDate: true } },
        },
        orderBy: { collectionDate: 'desc' },
        take: limit,
      })
      for (const c of collections) {
        txs.push({
          id: c.id,
          txNumber: c.receiptNumber,
          type: 'COLLECTION',
          side: 'CREDIT',
          date: c.collectionDate.toISOString(),
          businessDate: c.businessDate ? c.businessDate.businessDate.toISOString().slice(0, 10) : c.collectionDate.toISOString().slice(0, 10),
          customerName: c.customer.fullName,
          customerId: c.customer.customerId,
          accountNumber: c.account.accountNumber,
          amount: num(c.amount),
          paymentMode: c.paymentMode,
          createdBy: c.collectedBy.name,
          status: c.status,
          remarks: c.remarks || 'EMI Collection',
        })
      }
    }

    // 2. Disbursements (Debit) & Deducted/Recovered Charges (Credit)
    if (type === 'ALL' || type === 'DISBURSEMENT' || type === 'CHARGE_RECOVERY') {
      const accounts = await db.account.findMany({
        where: targetBusinessDateId ? { businessDateId: targetBusinessDateId } : {},
        include: {
          customer: { select: { fullName: true, customerId: true, primaryMobile: true } },
          createdBy: { select: { name: true } },
          businessDate: { select: { businessDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      for (const a of accounts) {
        const bDateStr = a.businessDate ? a.businessDate.businessDate.toISOString().slice(0, 10) : a.startDate.toISOString().slice(0, 10)

        // Principal Disbursement (Debit)
        if (type === 'ALL' || type === 'DISBURSEMENT') {
          txs.push({
            id: a.id,
            txNumber: a.accountNumber,
            type: 'DISBURSEMENT',
            side: 'DEBIT',
            date: a.startDate.toISOString(),
            businessDate: bDateStr,
            customerName: a.customer.fullName,
            customerId: a.customer.customerId,
            accountNumber: a.accountNumber,
            amount: num(a.principal),
            paymentMode: 'CASH', // default physical disbursement
            createdBy: a.createdBy.name,
            status: a.status,
            remarks: a.remarks || 'Loan Principal Disbursed',
          })
        }

        // Deducted or Recovered Charges: Always appears on CREDIT side
        const procFee = num(a.processingFee)
        const insPrem = num(a.insurancePremium)
        const totalCharges = procFee + insPrem

        if (totalCharges > 0 && (type === 'ALL' || type === 'CHARGE_RECOVERY')) {
          txs.push({
            id: `${a.id}-chg`,
            txNumber: `CHG-${a.accountNumber.slice(-4)}`,
            type: 'CHARGE_RECOVERY',
            side: 'CREDIT',
            date: a.startDate.toISOString(),
            businessDate: bDateStr,
            customerName: a.customer.fullName,
            customerId: a.customer.customerId,
            accountNumber: a.accountNumber,
            amount: totalCharges,
            paymentMode: 'DEDUCTION',
            createdBy: a.createdBy.name,
            status: 'SUCCESSFUL',
            remarks: `Recovered Charges (Proc Fee: ₹${procFee} + Ins: ₹${insPrem})`,
          })
        }
      }
    }

    // 3. Bank Deposits (Debit from Vault / Deposit to Bank)
    if (type === 'ALL' || type === 'BANK_DEPOSIT') {
      const deposits = await db.bankDeposit.findMany({
        where: targetBusinessDateId ? { businessDateId: targetBusinessDateId } : {},
        include: {
          businessDate: { select: { businessDate: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      for (const d of deposits) {
        txs.push({
          id: d.id,
          txNumber: d.depositNumber,
          type: 'BANK_DEPOSIT',
          side: 'DEBIT',
          date: d.depositDate.toISOString(),
          businessDate: d.businessDate.businessDate.toISOString().slice(0, 10),
          customerName: d.bankAccount,
          customerId: 'BANK',
          accountNumber: d.referenceNumber || '—',
          amount: num(d.amount),
          paymentMode: 'BANK',
          createdBy: d.createdBy.name,
          status: 'SUCCESSFUL',
          remarks: d.notes || 'Vault to Bank Deposit',
        })
      }
    }

    // 4. Investments (Inflow / Automatic Credit to Cash/Bank Balance)
    if (type === 'ALL' || type === 'INVESTMENT') {
      const investments = await db.investment.findMany({
        where: targetBusinessDateId ? { businessDateId: targetBusinessDateId } : {},
        include: {
          businessDate: { select: { businessDate: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { investmentDate: 'desc' },
        take: limit,
      })
      for (const inv of investments) {
        txs.push({
          id: inv.id,
          txNumber: inv.investmentNumber,
          type: 'INVESTMENT',
          side: 'CREDIT',
          date: inv.investmentDate.toISOString(),
          businessDate: inv.businessDate.businessDate.toISOString().slice(0, 10),
          customerName: inv.investorName,
          customerId: inv.investmentType,
          accountNumber: inv.investmentNumber,
          amount: num(inv.amount),
          paymentMode: inv.paymentMode,
          createdBy: inv.createdBy.name,
          status: inv.status,
          remarks: inv.remarks || `Investment received (${inv.investmentType})`,
        })
      }
    }

    // 5. Expenses (Outflow / Automatic Debit from Cash/Bank Balance)
    if (type === 'ALL' || type === 'EXPENSE') {
      const expenses = await db.expense.findMany({
        where: targetBusinessDateId ? { businessDateId: targetBusinessDateId } : {},
        include: {
          businessDate: { select: { businessDate: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { expenseDate: 'desc' },
        take: limit,
      })
      for (const exp of expenses) {
        txs.push({
          id: exp.id,
          txNumber: exp.expenseNumber,
          type: 'EXPENSE',
          side: 'DEBIT',
          date: exp.expenseDate.toISOString(),
          businessDate: exp.businessDate.businessDate.toISOString().slice(0, 10),
          customerName: exp.recipientName || exp.particulars,
          customerId: exp.expenseType,
          accountNumber: exp.voucherNumber || exp.expenseNumber,
          amount: num(exp.amount),
          paymentMode: exp.paymentMode,
          createdBy: exp.createdBy.name,
          status: exp.status,
          remarks: exp.remarks || exp.particulars,
        })
      }
    }

    // Sort all combined by timestamp desc
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return json({ items: txs.slice(0, limit) })
  })
}
