import { db } from './db'
import { toMoney, addMoney, subMoney, type Money } from './money'
import { parseCalendarDate, addPeriod, num } from './calc'
import { logAudit } from './audit'
import type { SessionUser } from './auth'

export interface BusinessDateWithTotals {
  id: string
  businessDate: string
  status: 'OPEN' | 'RECONCILIATION_PENDING' | 'CLOSED'
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
  cashDisbursements: number
  totalDisbursements: number
  bankDeposits: number
  expectedClosingCash: number
}

/**
 * Returns the currently active (OPEN or RECONCILIATION_PENDING) business date.
 * If none exists, automatically initializes today's date (or user requested) as the first business date.
 */
export async function getActiveBusinessDate(user?: SessionUser, tx?: any): Promise<any> {
  const client = tx || db
  let active = await client.businessDate.findFirst({
    where: { status: { in: ['OPEN', 'RECONCILIATION_PENDING'] } },
    include: {
      openedBy: { select: { id: true, name: true, role: true } },
      closedBy: { select: { id: true, name: true } },
    },
    orderBy: { businessDate: 'desc' },
  })

  if (!active) {
    // If no business date has ever been created, create the initial one
    const lastClosed = await client.businessDate.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { businessDate: 'desc' },
    })

    const initialDate = lastClosed ? addPeriod(parseCalendarDate(lastClosed.businessDate), 'DAILY') : parseCalendarDate(new Date())
    const initialOpening = lastClosed ? Number(lastClosed.closingCash) : 0
    const fallbackUserId = user?.id || (await client.user.findFirst({ where: { role: 'ADMIN' } }))?.id || ''

    if (fallbackUserId) {
      active = await client.businessDate.create({
        data: {
          businessDate: initialDate,
          status: 'OPEN',
          openedById: fallbackUserId,
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
      collections: { where: { status: 'SUCCESSFUL' }, select: { amount: true, paymentMode: true } },
      accounts: { where: { status: { not: 'CANCELLED' } }, select: { principal: true } },
      bankDeposits: { select: { amount: true } },
    },
  })

  if (!bDate) {
    throw new Error('Business date not found.')
  }

  const openingCash = num(bDate.openingCash)

  // Collections breakdown
  let cashCollections: Money = 0
  let otherCollections: Money = 0
  for (const c of bDate.collections) {
    const amt = num(c.amount)
    if (c.paymentMode === 'CASH') {
      cashCollections = addMoney(cashCollections, amt)
    } else {
      otherCollections = addMoney(otherCollections, amt)
    }
  }
  const totalCollections = addMoney(cashCollections, otherCollections)

  // Disbursements
  let cashDisbursements: Money = 0
  for (const a of bDate.accounts) {
    cashDisbursements = addMoney(cashDisbursements, num(a.principal))
  }
  const totalDisbursements = cashDisbursements

  // Bank deposits
  let bankDeposits: Money = 0
  for (const d of bDate.bankDeposits) {
    bankDeposits = addMoney(bankDeposits, num(d.amount))
  }

  // Formula: Expected Closing Cash = Opening Cash + Cash Collections - Cash Disbursements - Bank Deposits
  const expectedClosingCash = Math.max(0, subMoney(subMoney(addMoney(openingCash, cashCollections), cashDisbursements), bankDeposits))

  return {
    id: bDate.id,
    businessDate: bDate.businessDate.toISOString().slice(0, 10),
    status: bDate.status as any,
    openedAt: bDate.openedAt.toISOString(),
    openedBy: bDate.openedBy,
    closedAt: bDate.closedAt ? bDate.closedAt.toISOString() : null,
    closedBy: bDate.closedBy,
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
    cashDisbursements,
    totalDisbursements,
    bankDeposits,
    expectedClosingCash,
  }
}

/**
 * Asserts that a business date is OPEN before allowing new financial entries
 */
export async function assertBusinessDateOpen(businessDateId?: string | null): Promise<void> {
  if (!businessDateId) return
  const b = await db.businessDate.findUnique({ where: { id: businessDateId } })
  if (!b) throw new Error('Referenced business date does not exist.')
  if (b.status === 'CLOSED') {
    throw new Error(`Business date ${b.businessDate.toISOString().slice(0, 10)} is CLOSED. Financial modifications are locked.`)
  }
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
  return await db.$transaction(async (tx) => {
    const bDate = await tx.businessDate.findUnique({
      where: { id: businessDateId },
      include: {
        collections: { where: { status: 'SUCCESSFUL' }, select: { amount: true, paymentMode: true } },
        accounts: { select: { principal: true } },
        bankDeposits: { select: { amount: true } },
      },
    })

    if (!bDate) throw new Error('Business date not found.')
    if (bDate.status === 'CLOSED') throw new Error('Business date is already closed.')

    // Calculate exact closing cash
    const openingCash = num(bDate.openingCash)
    let cashCollections = 0
    for (const c of bDate.collections) {
      if (c.paymentMode === 'CASH') cashCollections = addMoney(cashCollections, num(c.amount))
    }
    let cashDisbursements = 0
    for (const a of bDate.accounts) {
      cashDisbursements = addMoney(cashDisbursements, num(a.principal))
    }
    let bankDeposits = 0
    for (const d of bDate.bankDeposits) {
      bankDeposits = addMoney(bankDeposits, num(d.amount))
    }

    const expectedClosingCash = Math.max(0, subMoney(subMoney(addMoney(openingCash, cashCollections), cashDisbursements), bankDeposits))
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
    
    // Check if next date already exists
    let nextDate = await tx.businessDate.findUnique({ where: { businessDate: nextCalendarDate } })
    if (nextDate) {
      nextDate = await tx.businessDate.update({
        where: { id: nextDate.id },
        data: {
          status: 'OPEN',
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
          openedById: user.id,
          openingCash: enteredActualCash,
          closingCash: enteredActualCash,
          reconciliationStatus: 'PENDING',
        },
      })
    }

    // 3. Log Audit entries
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

    return { closedDate, nextDate }
  })
}
