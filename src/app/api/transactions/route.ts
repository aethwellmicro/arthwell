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

    // 1. Collections
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
          date: c.collectionDate.toISOString(),
          businessDate: c.businessDate ? c.businessDate.businessDate.toISOString().slice(0, 10) : c.collectionDate.toISOString().slice(0, 10),
          customerName: c.customer.fullName,
          customerId: c.customer.customerId,
          accountNumber: c.account.accountNumber,
          amount: num(c.amount),
          paymentMode: c.paymentMode,
          createdBy: c.collectedBy.name,
          status: c.status,
          remarks: c.remarks,
        })
      }
    }

    // 2. Disbursements
    if (type === 'ALL' || type === 'DISBURSEMENT') {
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
        txs.push({
          id: a.id,
          txNumber: a.accountNumber,
          type: 'DISBURSEMENT',
          date: a.startDate.toISOString(),
          businessDate: a.businessDate ? a.businessDate.businessDate.toISOString().slice(0, 10) : a.startDate.toISOString().slice(0, 10),
          customerName: a.customer.fullName,
          customerId: a.customer.customerId,
          accountNumber: a.accountNumber,
          amount: num(a.principal),
          paymentMode: 'CASH', // default physical disbursement
          createdBy: a.createdBy.name,
          status: a.status,
          remarks: a.remarks,
        })
      }
    }

    // 3. Bank Deposits
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
          date: d.depositDate.toISOString(),
          businessDate: d.businessDate.businessDate.toISOString().slice(0, 10),
          customerName: d.bankAccount,
          customerId: 'BANK',
          accountNumber: d.referenceNumber || '—',
          amount: num(d.amount),
          paymentMode: 'BANK',
          createdBy: d.createdBy.name,
          status: 'SUCCESSFUL',
          remarks: d.notes,
        })
      }
    }

    // Sort all combined by timestamp desc
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return json({ items: txs.slice(0, limit) })
  })
}
