import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'
import { getActiveBusinessDate, assertBusinessDateOpen } from '@/lib/business-date'
import { getBranchFilter } from '@/lib/branch'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const customerId = searchParams.get('customerId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const employeeId = searchParams.get('employeeId') || undefined
    const paymentMode = searchParams.get('paymentMode') || undefined
    const status = searchParams.get('status') || undefined
    const branchId = searchParams.get('branchId') || undefined
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

    Object.assign(where, getBranchFilter(user, branchId))

    const collections = await db.collection.findMany({
      where,
      include: {
        customer: { select: { customerId: true, fullName: true, primaryMobile: true, area: true } },
        account: { select: { accountNumber: true } },
        collectedBy: { select: { name: true, employeeCode: true } },
        branch: { select: { id: true, branchCode: true, name: true } },
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
    const rawAmount = parseFloat(body.amount)
    const emiAmount = body.emiAmount !== undefined && body.emiAmount !== '' ? parseFloat(body.emiAmount) : null
    const savingsAmount = body.savingsAmount !== undefined && body.savingsAmount !== '' ? parseFloat(body.savingsAmount) : null

    // Determine total amount
    let amount = rawAmount
    if (isNaN(amount) || amount <= 0) {
      if (emiAmount !== null || savingsAmount !== null) {
        amount = (emiAmount || 0) + (savingsAmount || 0)
      }
    }

    const paymentMode = (body.paymentMode || '').toString()
    const collectionDateStr = (body.collectionDate || '').toString()
    let remarks = (body.remarks || '').toString().trim()

    // Add structured breakdown to remarks if EMI and/or Savings provided
    if (emiAmount !== null || savingsAmount !== null) {
      const parts: string[] = []
      if (emiAmount !== null && !isNaN(emiAmount)) parts.push(`EMI: ₹${emiAmount.toFixed(2)}`)
      if (savingsAmount !== null && !isNaN(savingsAmount)) parts.push(`Savings: ₹${savingsAmount.toFixed(2)}`)
      const breakdownNote = `[${parts.join(' | ')}]`
      if (!remarks) {
        remarks = breakdownNote
      } else if (!remarks.includes('EMI:') && !remarks.includes('Savings:')) {
        remarks = `${remarks} ${breakdownNote}`
      }
    }

    if (!customerId) return error('Customer is required.', 422)
    if (!accountId) return error('Account is required.', 422)
    if (!amount || amount <= 0) return error('Collected amount must be greater than 0.', 422)
    if (!['CASH', 'UPI', 'BANK', 'OTHER'].includes(paymentMode)) return error('Invalid payment mode.', 422)
    if (!collectionDateStr) return error('Collection date is required.', 422)

    const account = await db.account.findFirst({
      where: { id: accountId, ...getBranchFilter(user) },
      include: { customer: true, branch: { select: { name: true } } },
    })
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

    const activeBDate = await getActiveBusinessDate(user, undefined, collectionDateStr || undefined)
    if (!activeBDate) {
      return error('No active business date found. Please initialize a business date first.', 422)
    }
    await assertBusinessDateOpen(activeBDate.id)

    // generate receipt number & execute creation atomically
    const prefix = 'RCP'
    const collectionDate = new Date(collectionDateStr)

    // Per Master Specification:
    // Field Officer collection entries MUST default to PENDING_APPROVAL.
    // They must NOT immediately affect final cash book or loan installment balances until Back Office approval.
    const initialStatus = 'PENDING_APPROVAL'

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
          branchId: account.customer.branchId || user.branchId || null,
          collectionDate,
          amount,
          allocatedPrincipal: 0,
          allocatedInterest: 0,
          allocatedSavings: savingsAmount || 0,
          paymentMode,
          collectedById: user.id,
          previousOutstanding,
          currentOutstanding,
          remarks: remarks || null,
          status: initialStatus,
        },
      })

      const newReceipt = await tx.receipt.create({
        data: {
          collectionId: newCollection.id,
          receiptNumber,
          branchName: account.branch?.name || account.customer.branch || 'Branch Office',
          printCount: 0,
        },
      })

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
        status: initialStatus,
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
