import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'
import { getActiveBusinessDate, assertBusinessDateOpen } from '@/lib/business-date'

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const customerId = searchParams.get('customerId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const employeeId = searchParams.get('employeeId') || undefined
    const paymentMode = searchParams.get('paymentMode') || undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '200')

    const where: any = {}
    if (from || to) {
      where.collectionDate = {}
      if (from) where.collectionDate.gte = new Date(from)
      if (to) where.collectionDate.lte = new Date(to)
    }
    if (customerId) where.customerId = customerId
    if (accountId) where.accountId = accountId
    if (employeeId) where.collectedById = employeeId
    if (paymentMode) where.paymentMode = paymentMode
    if (status) where.status = status

    const collections = await db.collection.findMany({
      where,
      include: {
        customer: { select: { customerId: true, fullName: true, primaryMobile: true, area: true } },
        account: { select: { accountNumber: true } },
        collectedBy: { select: { name: true, employeeCode: true } },
        receipt: true,
      },
      orderBy: { collectionDate: 'desc' },
      take: limit,
    })

    const items = collections.map((c) => ({
      ...c,
      amount: num(c.amount),
      previousOutstanding: num(c.previousOutstanding),
      currentOutstanding: num(c.currentOutstanding),
    }))

    return json({ items })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await parseBody(req)
    const customerId = (body.customerId || '').toString()
    const accountId = (body.accountId || '').toString()
    const amount = parseFloat(body.amount)
    const paymentMode = (body.paymentMode || '').toString()
    const collectionDateStr = (body.collectionDate || '').toString()
    const remarks = (body.remarks || '').toString()

    if (!customerId) return error('Customer is required.', 422)
    if (!accountId) return error('Account is required.', 422)
    if (!amount || amount <= 0) return error('Collected amount must be greater than 0.', 422)
    if (!['CASH', 'UPI', 'BANK', 'OTHER'].includes(paymentMode)) return error('Invalid payment mode.', 422)
    if (!collectionDateStr) return error('Collection date is required.', 422)

    const account = await db.account.findUnique({ where: { id: accountId }, include: { customer: true } })
    if (!account) return error('Account not found.', 404)
    if (account.customerId !== customerId) return error('Account does not belong to the selected customer.', 422)
    if (account.status !== 'ACTIVE' && account.status !== 'OVERDUE') {
      return error(`Cannot collect against a ${account.status} account unless explicitly authorized.`, 422)
    }

    // calculate balances
    const collectedAgg = await db.collection.aggregate({
      where: { accountId, status: 'SUCCESSFUL' },
      _sum: { amount: true },
    })
    const paidToDate = num(collectedAgg._sum.amount)
    const totalPayable = num(account.totalPayable)
    const previousOutstanding = Math.max(totalPayable - paidToDate, 0)
    const currentOutstanding = Math.max(previousOutstanding - amount, 0)

    if (amount > previousOutstanding + 0.01) {
      return error(`Amount exceeds outstanding balance (${previousOutstanding.toFixed(2)}).`, 422)
    }

    // duplicate prevention: same account + same amount + same date + same paymentMode within 60s
    const recent = await db.collection.findFirst({
      where: {
        accountId,
        amount,
        paymentMode,
        collectionDate: new Date(collectionDateStr),
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    })
    if (recent) return error('A duplicate collection entry was detected. Please wait or check the list.', 409)

    const activeBDate = await getActiveBusinessDate(user)
    if (!activeBDate) {
      return error('No active business date found. Please initialize a business date first.', 422)
    }
    await assertBusinessDateOpen(activeBDate.id)

    // generate receipt number & execute transaction atomically
    const prefix = 'RCP'
    const collectionDate = new Date(collectionDateStr)

    const { collection, receipt } = await db.$transaction(async (tx) => {
      const last = await tx.collection.findFirst({ orderBy: { createdAt: 'desc' } })
      let nextN = 0
      if (last && last.receiptNumber) {
        const m = last.receiptNumber.match(/(\d+)$/)
        if (m) nextN = parseInt(m[1])
      }
      const receiptNumber = `${prefix}-${String(nextN + 1).padStart(5, '0')}`

      const newCollection = await tx.collection.create({
        data: {
          receiptNumber,
          customerId,
          accountId,
          businessDateId: activeBDate.id,
          collectionDate,
          amount,
          paymentMode,
          collectedById: user.id,
          previousOutstanding,
          currentOutstanding,
          remarks: remarks || null,
          status: 'SUCCESSFUL',
        },
      })

      const newReceipt = await tx.receipt.create({
        data: {
          collectionId: newCollection.id,
          receiptNumber,
          branchName: 'ArthWell Micro Finance - Main Branch',
          printCount: 0,
        },
      })

      // update installment allocation (FIFO) inside same tx
      const installments = await tx.installment.findMany({
        where: { accountId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { installNo: 'asc' },
      })
      let remaining = amount
      for (const inst of installments) {
        if (remaining <= 0) break
        const due = num(inst.amount)
        const alreadyPaid = num(inst.paidAmount)
        const needed = Math.max(due - alreadyPaid, 0)
        if (needed <= 0) continue
        const pay = Math.min(needed, remaining)
        const newPaid = alreadyPaid + pay
        const status = newPaid >= due - 0.01 ? 'PAID' : 'PARTIAL'
        await tx.installment.update({
          where: { id: inst.id },
          data: { paidAmount: newPaid, status, paidDate: collectionDate },
        })
        remaining -= pay
      }

      // notification
      const message = `Dear ${account.customer.fullName}, we received ${amount.toFixed(2)} via ${paymentMode} on ${collectionDate.toISOString().slice(0, 10)}. Outstanding: ${currentOutstanding.toFixed(2)}. Receipt: ${receiptNumber}. Thank you.`
      await tx.notification.create({
        data: {
          collectionId: newCollection.id,
          customerId,
          type: 'PAYMENT_CONFIRMATION',
          message,
          recipient: account.customer.primaryMobile,
          status: 'SENT',
          userId: user.id,
        },
      })

      // update account status if completed
      if (currentOutstanding <= 0.01) {
        await tx.account.update({ where: { id: accountId }, data: { status: 'COMPLETED' } })
      }

      return { collection: newCollection, receipt: newReceipt }
    })

    await logAudit({
      user,
      action: 'COLLECTION_RECORDED',
      entity: 'COLLECTION',
      entityId: collection.id,
      newValue: {
        receiptNumber: collection.receiptNumber,
        accountId,
        amount,
        paymentMode,
        currentOutstanding,
        businessDate: activeBDate.businessDate,
      },
    })

    return json({
      ...collection,
      amount: num(collection.amount),
      previousOutstanding: num(collection.previousOutstanding),
      currentOutstanding: num(collection.currentOutstanding),
      receipt,
    }, 201)
  })
}

async function allocateToInstallments(accountId: string, amount: number, paidDate: Date) {
  const installments = await db.installment.findMany({
    where: { accountId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    orderBy: { installNo: 'asc' },
  })
  let remaining = amount
  for (const inst of installments) {
    if (remaining <= 0) break
    const due = num(inst.amount)
    const alreadyPaid = num(inst.paidAmount)
    const needed = Math.max(due - alreadyPaid, 0)
    if (needed <= 0) continue
    const pay = Math.min(needed, remaining)
    const newPaid = alreadyPaid + pay
    const status = newPaid >= due - 0.01 ? 'PAID' : 'PARTIAL'
    await db.installment.update({
      where: { id: inst.id },
      data: { paidAmount: newPaid, status, paidDate },
    })
    remaining -= pay
  }
}
