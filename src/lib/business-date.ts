import { db } from './db'
import { toMoney, addMoney, subMoney, type Money } from './money'
import { parseCalendarDate, addPeriod, num } from './calc'
import { logAudit } from './audit'
import type { SessionUser } from './auth'

export interface BusinessDateWithTotals {
  id: string
  businessDate: string
  status: 'OPEN' | 'RECONCILIATION_PENDING' | 'CLOSED' | 'REOPENED'
  openedAt: string
  openedBy: { id: string; name: string }
  closedAt?: string | null
  closedBy?: { id: string; name: string } | null
  openingCash: number
  closingCash: number
  actualCashInHand: number
  cashDifference: number
  differenceReason?: string | null
  reconciliationStatus: string
  notes?: string | null
  // Live totals calculated for active day
  cashCollections: number
  otherCollections: number
  totalCollections: number
  pendingCollectionsCount: number
  pendingCollectionsAmount: number
  rejectedCollectionsCount: number
  rejectedCollectionsAmount: number
  cashDisbursements: number
  totalDisbursements: number
  bankDeposits: number
  cashInvestments: number
  totalInvestments: number
  cashExpenses: number
  totalExpenses: number
  feesCollected: number
  expectedClosingCash: number
}

/**
 * Returns the currently active (OPEN, REOPENED or RECONCILIATION_PENDING) business date.
 * If a targetDate is provided, matches that specific date or automatically initializes it.
 * If none exists, automatically initializes today's date (or user requested) as the first business date.
 */
export async function getActiveBusinessDate(user?: SessionUser, tx?: any, targetDate?: string | Date | null): Promise<any> {
  const client = tx || db
  const branchScope = user && user.role !== 'ADMIN'
    ? { branchId: user.branchId || '__UNASSIGNED__' }
    : {}

  // 1. If targetDate is provided (e.g. backdated transaction for 2026-07-27)
  if (targetDate) {
    const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
    if (!isNaN(d.getTime())) {
      const dateStr = d.toISOString().slice(0, 10)
      const dayStart = new Date(dateStr + 'T00:00:00.000Z')
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z')

      // Look for OPEN/REOPENED date in that day window
      let matched = await client.businessDate.findFirst({
        where: {
          businessDate: { gte: dayStart, lte: dayEnd },
          status: { in: ['OPEN', 'REOPENED', 'RECONCILIATION_PENDING'] },
          ...branchScope,
        },
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
          closedBy: { select: { id: true, name: true } },
          reopenedBy: { select: { id: true, name: true } },
        },
        orderBy: { businessDate: 'asc' },
      })

      if (matched) return matched

      // If existing but closed, still return it so the caller can handle or reopen
      const closed = await client.businessDate.findFirst({
        where: {
          businessDate: { gte: dayStart, lte: dayEnd },
          ...branchScope,
        },
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
          closedBy: { select: { id: true, name: true } },
          reopenedBy: { select: { id: true, name: true } },
        },
      })
      if (closed) return closed

      // If no business date exists for this date, create it automatically as OPEN
      const fallbackUserId = user?.id || (await client.user.findFirst({ where: { role: 'ADMIN' } }))?.id || ''
      if (fallbackUserId) {
        const exactDate = parseCalendarDate(dateStr)
        const previousClosedDate = await client.businessDate.findFirst({
          where: {
            businessDate: { lt: exactDate },
            status: 'CLOSED',
            ...branchScope,
          },
          orderBy: { businessDate: 'desc' },
          select: { closingCash: true },
        })
        const openingCash = previousClosedDate ? num(previousClosedDate.closingCash) : 0
        matched = await client.businessDate.create({
          data: {
            businessDate: exactDate,
            status: 'OPEN',
            openedById: fallbackUserId,
            branchId: user?.branchId || null,
            openingCash,
            closingCash: openingCash,
            reconciliationStatus: 'PENDING',
          },
          include: {
            openedBy: { select: { id: true, name: true, role: true } },
            closedBy: { select: { id: true, name: true } },
          },
        })
        return matched
      }
    }
  }

  let active = await client.businessDate.findFirst({
    where: { status: { in: ['OPEN', 'REOPENED', 'RECONCILIATION_PENDING'] }, ...branchScope },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      closedBy: { select: { id: true, name: true } },
      reopenedBy: { select: { id: true, name: true } },
    },
    orderBy: { businessDate: 'asc' },
  })

  if (!active) {
    // If no business date has ever been created, create the initial one
    const lastClosed = await client.businessDate.findFirst({
      where: { status: 'CLOSED', ...branchScope },
      orderBy: { businessDate: 'desc' },
    })

    const initialDate = lastClosed ? addPeriod(parseCalendarDate(lastClosed.businessDate), 'DAILY') : parseCalendarDate('2026-07-25')
    const initialOpening = lastClosed ? Number(lastClosed.closingCash) : 0
    const fallbackUserId = user?.id || (await client.user.findFirst({ where: { role: 'ADMIN' } }))?.id || ''

    if (fallbackUserId) {
      active = await client.businessDate.create({
        data: {
          businessDate: initialDate,
          status: 'OPEN',
          openedById: fallbackUserId,
          branchId: user?.branchId || null,
          openingCash: initialOpening,
          closingCash: initialOpening,
          reconciliationStatus: 'PENDING',
        },
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
          closedBy: { select: { id: true, name: true } },
        },
      })
      if (user) {
        await logAudit({
          user,
          action: 'BUSINESS_DATE_OPENED',
          entity: 'BUSINESS_DATE',
          entityId: active.id,
          newValue: { businessDate: active.businessDate, openingCash: initialOpening },
        })
      }
    }
  }

  return active
}

/**
 * Calculates live cash flow and expected closing cash for a business date
 */
export async function getBusinessDateSummary(businessDateId: string, tx?: any): Promise<BusinessDateWithTotals> {
  const client = tx || db
  const bDate = await client.businessDate.findUnique({
    where: { id: businessDateId },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      collections: { select: { amount: true, paymentMode: true, status: true } },
      accounts: { where: { status: { not: 'CANCELLED' } }, select: { principal: true, processingFee: true, insurancePremium: true } },
      bankDeposits: { select: { amount: true } },
      investments: { where: { status: { not: 'CANCELLED' } }, select: { amount: true, paymentMode: true } },
      expenses: { where: { status: { not: 'CANCELLED' } }, select: { amount: true, paymentMode: true } },
    },
  })

  if (!bDate) {
    throw new Error('Business date not found.')
  }

  const openingCash = num(bDate.openingCash)

  // Collections breakdown - ONLY APPROVED or legacy SUCCESSFUL count towards cash flow!
  let cashCollections: Money = 0
  let otherCollections: Money = 0
  let pendingCollectionsCount = 0
  let pendingCollectionsAmount: Money = 0
  let rejectedCollectionsCount = 0
  let rejectedCollectionsAmount: Money = 0

  for (const c of bDate.collections) {
    const amt = num(c.amount)
    if (c.status === 'APPROVED' || c.status === 'SUCCESSFUL') {
      if (c.paymentMode === 'CASH') {
        cashCollections = addMoney(cashCollections, amt)
      } else {
        otherCollections = addMoney(otherCollections, amt)
      }
    } else if (c.status === 'PENDING_APPROVAL') {
      pendingCollectionsCount++
      pendingCollectionsAmount = addMoney(pendingCollectionsAmount, amt)
    } else if (c.status === 'REJECTED') {
      rejectedCollectionsCount++
      rejectedCollectionsAmount = addMoney(rejectedCollectionsAmount, amt)
    }
  }
  const totalCollections = addMoney(cashCollections, otherCollections)

  // Disbursements and Fees
  let cashDisbursements: Money = 0
  let feesCollected: Money = 0
  for (const a of bDate.accounts) {
    cashDisbursements = addMoney(cashDisbursements, num(a.principal))
    feesCollected = addMoney(feesCollected, num(a.processingFee))
    feesCollected = addMoney(feesCollected, num(a.insurancePremium))
  }
  const totalDisbursements = cashDisbursements

  // Bank deposits
  let bankDeposits: Money = 0
  for (const d of bDate.bankDeposits) {
    bankDeposits = addMoney(bankDeposits, num(d.amount))
  }

  // Investments breakdown (Inflow / Credit)
  let cashInvestments: Money = 0
  let totalInvestments: Money = 0
  for (const inv of bDate.investments) {
    const amt = num(inv.amount)
    totalInvestments = addMoney(totalInvestments, amt)
    if (inv.paymentMode === 'CASH') {
      cashInvestments = addMoney(cashInvestments, amt)
    }
  }

  // Expenses breakdown (Outflow / Debit)
  let cashExpenses: Money = 0
  let totalExpenses: Money = 0
  for (const exp of bDate.expenses) {
    const amt = num(exp.amount)
    totalExpenses = addMoney(totalExpenses, amt)
    if (exp.paymentMode === 'CASH') {
      cashExpenses = addMoney(cashExpenses, amt)
    }
  }

  // Authoritative Formula:
  // Expected Closing Cash = Opening Cash + Cash Collections + Cash Investments + Fees Collected - Cash Disbursements - Cash Expenses - Bank Deposits
  const totalInflow = addMoney(addMoney(addMoney(openingCash, cashCollections), cashInvestments), feesCollected)
  const totalOutflow = addMoney(addMoney(cashDisbursements, cashExpenses), bankDeposits)
  const expectedClosingCash = Math.max(0, subMoney(totalInflow, totalOutflow))

  return {
    id: bDate.id,
    businessDate: bDate.businessDate ? bDate.businessDate.toISOString().slice(0, 10) : '',
    status: bDate.status as any,
    openedAt: bDate.openedAt ? bDate.openedAt.toISOString() : new Date().toISOString(),
    openedBy: bDate.openedBy || { id: bDate.openedById || '', name: 'System' },
    closedAt: bDate.closedAt ? bDate.closedAt.toISOString() : null,
    closedBy: bDate.closedBy || null,
    openingCash,
    closingCash: num(bDate.closingCash) || expectedClosingCash,
    actualCashInHand: num(bDate.actualCashInHand),
    cashDifference: num(bDate.cashDifference),
    differenceReason: bDate.differenceReason,
    reconciliationStatus: bDate.reconciliationStatus,
    notes: bDate.notes,
    cashCollections,
    otherCollections,
    totalCollections,
    pendingCollectionsCount,
    pendingCollectionsAmount,
    rejectedCollectionsCount,
    rejectedCollectionsAmount,
    cashDisbursements,
    totalDisbursements,
    bankDeposits,
    cashInvestments,
    totalInvestments,
    cashExpenses,
    totalExpenses,
    feesCollected,
    expectedClosingCash,
  }
}

/**
 * Asserts that a business date is OPEN or REOPENED before allowing new financial entries
 */
export async function assertBusinessDateOpen(businessDateId?: string | null): Promise<void> {
  if (!businessDateId) return
  const b = await db.businessDate.findUnique({ where: { id: businessDateId } })
  if (!b) throw new Error('Referenced business date does not exist.')
  if (b.status === 'CLOSED') {
    throw new Error(`Business date ${b.businessDate.toISOString().slice(0, 10)} is CLOSED. Contact an authorized administrator to reopen it.`)
  }
}

/**
 * Reopens a previously CLOSED business date for Admin corrections
 */
export async function reopenBusinessDate({
  user,
  businessDateId,
  reason,
}: {
  user: SessionUser
  businessDateId: string
  reason: string
}): Promise<any> {
  if (user.role !== 'ADMIN') {
    throw new Error('Unauthorized. Only an Administrator can reopen a closed business date.')
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('A mandatory reason is required to reopen a business date.')
  }

  return await db.$transaction(async (tx) => {
    const b = await tx.businessDate.findUnique({ where: { id: businessDateId } })
    if (!b) throw new Error('Business date not found.')
    if (b.status === 'OPEN' || b.status === 'REOPENED') {
      return b
    }

    const reopened = await tx.businessDate.update({
      where: { id: businessDateId },
      data: {
        status: 'REOPENED',
        reopenedAt: new Date(),
        reopenedById: user.id,
        reopenReason: reason.trim(),
      },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        reopenedBy: { select: { id: true, name: true } },
      },
    })

    await logAudit({
      user,
      action: 'EOD_REOPENED',
      entity: 'BUSINESS_DATE',
      entityId: b.id,
      oldValue: { status: b.status },
      newValue: { status: 'REOPENED', reopenedAt: reopened.reopenedAt, reason: reason.trim() },
      reason: reason.trim(),
    })

    return reopened
  })
}

/**
 * Closes current active Business Date after verifying reconciliation and opens next business date
 */
export async function closeActiveBusinessDate({
  user,
  businessDateId,
  actualCashInHand,
  differenceReason,
  notes,
}: {
  user: SessionUser
  businessDateId: string
  actualCashInHand: number
  differenceReason?: string
  notes?: string
}): Promise<{ closedDate: any; nextDate: any }> {
  const result = await db.$transaction(async (tx) => {
    const bDate = await tx.businessDate.findUnique({
      where: { id: businessDateId },
      include: {
        collections: { select: { amount: true, paymentMode: true, status: true } },
        accounts: {
          where: { status: { not: 'CANCELLED' } },
          select: { principal: true, processingFee: true, insurancePremium: true },
        },
        bankDeposits: { select: { amount: true } },
        investments: { where: { status: { not: 'CANCELLED' } }, select: { amount: true, paymentMode: true } },
        expenses: { where: { status: { not: 'CANCELLED' } }, select: { amount: true, paymentMode: true } },
      },
    })

    if (!bDate) throw new Error('Business date not found.')
    if (user.role !== 'ADMIN' && bDate.branchId !== user.branchId) {
      throw new Error('You are not authorized to close another branch business date.')
    }
    if (bDate.status === 'CLOSED') throw new Error('Business date is already closed.')

    // Calculate exact closing cash
    const openingCash = num(bDate.openingCash)
    let cashCollections = 0
    let pendingCount = 0
    for (const c of bDate.collections) {
      if (c.status === 'APPROVED' || c.status === 'SUCCESSFUL') {
        if (c.paymentMode === 'CASH') cashCollections = addMoney(cashCollections, num(c.amount))
      } else if (c.status === 'PENDING_APPROVAL') {
        pendingCount++
      }
    }
    let cashDisbursements = 0
    let feesCollected = 0
    for (const a of bDate.accounts) {
      cashDisbursements = addMoney(cashDisbursements, num(a.principal))
      feesCollected = addMoney(feesCollected, num(a.processingFee))
      feesCollected = addMoney(feesCollected, num(a.insurancePremium))
    }
    let bankDeposits = 0
    for (const d of bDate.bankDeposits) {
      bankDeposits = addMoney(bankDeposits, num(d.amount))
    }

    let cashInvestments = 0
    for (const inv of bDate.investments) {
      if (inv.paymentMode === 'CASH') cashInvestments = addMoney(cashInvestments, num(inv.amount))
    }

    let cashExpenses = 0
    for (const exp of bDate.expenses) {
      if (exp.paymentMode === 'CASH') cashExpenses = addMoney(cashExpenses, num(exp.amount))
    }

    const totalInflow = addMoney(addMoney(addMoney(openingCash, cashCollections), cashInvestments), feesCollected)
    const totalOutflow = addMoney(addMoney(cashDisbursements, cashExpenses), bankDeposits)
    const expectedClosingCash = Math.max(0, subMoney(totalInflow, totalOutflow))
    const enteredActualCash = toMoney(actualCashInHand)
    const difference = subMoney(enteredActualCash, expectedClosingCash)

    if (difference !== 0 && (!differenceReason || differenceReason.trim().length === 0)) {
      throw new Error(`Cash difference of ₹${Math.abs(difference).toFixed(2)} detected. An authorized explanation is mandatory before EOD closure.`)
    }

    const reconciliationStatus = difference === 0 ? 'BALANCED' : 'DIFFERENCE_RESOLVED'

    // 1. Close current date
    const closedDate = await tx.businessDate.update({
      where: { id: businessDateId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: user.id,
        closingCash: expectedClosingCash,
        actualCashInHand: enteredActualCash,
        cashDifference: difference,
        differenceReason: difference !== 0 ? differenceReason?.trim() : null,
        reconciliationStatus,
        notes: notes?.trim() || null,
        authorizedById: difference !== 0 ? user.id : null,
      },
    })

    // 2. Open next business date automatically
    const nextCalendarDate = addPeriod(parseCalendarDate(bDate.businessDate), 'DAILY')
    
    // Check if next date already exists for this branch (handling null branchId safely)
    let nextDate = await tx.businessDate.findFirst({
      where: {
        businessDate: nextCalendarDate,
        branchId: bDate.branchId ?? null,
      },
    })
    if (nextDate) {
      nextDate = await tx.businessDate.update({
        where: { id: nextDate.id },
        data: {
          status: 'OPEN',
          branchId: bDate.branchId,
          openingCash: enteredActualCash,
          closingCash: enteredActualCash,
          openedById: user.id,
          openedAt: new Date(),
        },
      })
    } else {
      nextDate = await tx.businessDate.create({
        data: {
          businessDate: nextCalendarDate,
          status: 'OPEN',
          branchId: bDate.branchId,
          openedById: user.id,
          openingCash: enteredActualCash,
          closingCash: enteredActualCash,
          reconciliationStatus: 'PENDING',
        },
      })
    }

    return { closedDate, nextDate, expectedClosingCash, enteredActualCash, difference }
  }, { timeout: 15000, maxWait: 10000 })

  const { closedDate, nextDate, expectedClosingCash, enteredActualCash, difference } = result

  // 3. Log Audit entries outside transaction to avoid connection pool contention
  if (user) {
    await logAudit({
      user,
      action: 'EOD_CLOSED',
      entity: 'BUSINESS_DATE',
      entityId: closedDate.id,
      newValue: {
        businessDate: closedDate.businessDate,
        expectedClosingCash,
        actualCashInHand: enteredActualCash,
        difference,
        differenceReason,
        nextDate: nextDate.businessDate,
      },
      reason: difference !== 0 ? `Reconciled with difference: ${differenceReason}` : 'EOD Closed Balanced',
    })

    await logAudit({
      user,
      action: 'BUSINESS_DATE_OPENED',
      entity: 'BUSINESS_DATE',
      entityId: nextDate.id,
      newValue: {
        businessDate: nextDate.businessDate,
        openingCash: enteredActualCash,
      },
    })
  }

  return { closedDate, nextDate }
}
