import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate, getBusinessDateSummary, closeActiveBusinessDate } from '@/lib/business-date'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { getBranchFilter } from '@/lib/branch'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    try {
      const { searchParams } = new URL(req.url)
      const history = searchParams.get('history') === 'true'

      if (history) {
        const records = await db.businessDate.findMany({
          where: { status: 'CLOSED', ...getBranchFilter(user) },
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
            businessDate: r.businessDate ? r.businessDate.toISOString().slice(0, 10) : '',
            openingCash: Number(r.openingCash || 0),
            closingCash: Number(r.closingCash || 0),
            actualCashInHand: Number(r.actualCashInHand || 0),
            cashDifference: Number(r.cashDifference || 0),
          })),
        })
      }

      const dateParam = searchParams.get('date')
      let active: any = null
      try {
        active = await getActiveBusinessDate(user, undefined, dateParam)
      } catch (err: any) {
        console.error('Error fetching active business date:', err)
      }

      if (!active) {
        return json({ active: null, summary: null, openDates: [] })
      }

      let summary: any = null
      try {
        summary = await getBusinessDateSummary(active.id)
      } catch (err: any) {
        console.error('Error calculating business date summary:', err)
      }

      let openDates: any[] = []
      try {
        openDates = await db.businessDate.findMany({
          where: { status: { in: ['OPEN', 'REOPENED', 'RECONCILIATION_PENDING'] }, ...getBranchFilter(user) },
          orderBy: { businessDate: 'asc' },
          select: { id: true, businessDate: true, status: true },
        })
      } catch (err: any) {
        console.error('Error fetching open dates:', err)
      }

      return json({
        active,
        summary,
        openDates: openDates.map((d) => ({
          id: d.id,
          businessDate: d.businessDate ? d.businessDate.toISOString().slice(0, 10) : '',
          status: d.status,
        })),
      })
    } catch (err: any) {
      console.error('EOD GET handler fatal error:', err)
      return error(err.message || 'Failed to load EOD information.', 500)
    }
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
      active = await db.businessDate.findFirst({
        where: { id: targetBusinessDateId, ...getBranchFilter(user) },
      })
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
