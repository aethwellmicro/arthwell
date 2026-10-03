import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate, getBusinessDateSummary, closeActiveBusinessDate } from '@/lib/business-date'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(req.url)
    const history = searchParams.get('history') === 'true'

    if (history) {
      const records = await db.businessDate.findMany({
        where: { status: 'CLOSED' },
        include: {
          openedBy: { select: { name: true } },
          closedBy: { select: { name: true } },
          _count: { select: { collections: true, accounts: true, bankDeposits: true } },
        },
        orderBy: { businessDate: 'desc' },
        take: 100,
      })
      return json({
        items: records.map((r) => ({
          ...r,
          businessDate: r.businessDate.toISOString().slice(0, 10),
          openingCash: Number(r.openingCash),
          closingCash: Number(r.closingCash),
          actualCashInHand: Number(r.actualCashInHand),
          cashDifference: Number(r.cashDifference),
        })),
      })
    }

    const dateParam = searchParams.get('date')
    const active = await getActiveBusinessDate(user, undefined, dateParam)
    if (!active) return json({ active: null, summary: null, openDates: [] })
    const summary = await getBusinessDateSummary(active.id)

    const openDates = await db.businessDate.findMany({
      where: { status: { in: ['OPEN', 'REOPENED', 'RECONCILIATION_PENDING'] } },
      orderBy: { businessDate: 'asc' },
      select: { id: true, businessDate: true, status: true },
    })

    return json({
      active,
      summary,
      openDates: openDates.map((d) => ({
        id: d.id,
        businessDate: d.businessDate.toISOString().slice(0, 10),
        status: d.status,
      })),
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    // Only Branch Manager or Admin can finalize and close Day End
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Unauthorized to perform Day End closure. Only Branch Manager or Admin is permitted.', 403)
    }

    const body = await parseBody(req)
    const actualCashInHand = parseFloat(body.actualCashInHand)
    const differenceReason = body.differenceReason ? String(body.differenceReason) : undefined
    const notes = body.notes ? String(body.notes) : undefined

    if (isNaN(actualCashInHand) || actualCashInHand < 0) {
      return error('Actual physical cash counted is required and must be non-negative.', 422)
    }

    const targetBusinessDateId = body.businessDateId
    let active: any
    if (targetBusinessDateId) {
      active = await db.businessDate.findUnique({ where: { id: targetBusinessDateId } })
    } else if (body.businessDate) {
      active = await getActiveBusinessDate(user, undefined, body.businessDate)
    } else {
      active = await getActiveBusinessDate(user)
    }

    if (!active) {
      return error('No active business date found to close.', 404)
    }

    try {
      const result = await closeActiveBusinessDate({
        user,
        businessDateId: active.id,
        actualCashInHand,
        differenceReason,
        notes,
      })

      return json({
        success: true,
        message: `Day end closed successfully for ${result.closedDate.businessDate.toISOString().slice(0, 10)}. Next business date ${result.nextDate.businessDate.toISOString().slice(0, 10)} is now OPEN.`,
        closedDate: {
          ...result.closedDate,
          businessDate: result.closedDate.businessDate.toISOString().slice(0, 10),
        },
        nextDate: {
          ...result.nextDate,
          businessDate: result.nextDate.businessDate.toISOString().slice(0, 10),
        },
      })
    } catch (e: any) {
      return error(e.message, 422)
    }
  })
}
