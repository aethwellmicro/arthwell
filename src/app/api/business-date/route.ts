import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate, getBusinessDateSummary } from '@/lib/business-date'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseCalendarDate } from '@/lib/calc'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const active = await getActiveBusinessDate(user, undefined, dateParam)
    if (!active) {
      return json({ active: null, summary: null, openDates: [] })
    }
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
    // Only Admin or Branch Manager can manually open or adjust a business date's opening cash
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Unauthorized to configure business dates.', 403)
    }

    const body = await parseBody(req)
    const requestedDate = body.businessDate ? parseCalendarDate(body.businessDate) : parseCalendarDate(new Date())
    const openingCash = body.openingCash !== undefined ? parseFloat(body.openingCash) : 0

    // Check if an OPEN date already exists
    const existingOpen = await db.businessDate.findFirst({
      where: { status: { in: ['OPEN', 'RECONCILIATION_PENDING'] } },
    })

    if (existingOpen) {
      // If the caller requested the same date or didn't specify a date, update opening cash
      const sameDate = body.businessDate ? existingOpen.businessDate.toISOString().slice(0, 10) === requestedDate.toISOString().slice(0, 10) : true
      if (sameDate) {
        const updated = await db.businessDate.update({
          where: { id: existingOpen.id },
          data: {
            openingCash,
            closingCash: openingCash,
          },
        })
        await logAudit({
          user,
          action: 'BUSINESS_DATE_UPDATED',
          entity: 'BUSINESS_DATE',
          entityId: updated.id,
          newValue: { openingCash },
        })
        const summary = await getBusinessDateSummary(updated.id)
        return json({ active: updated, summary })
      }
    }

    // Check if record for requestedDate already exists
    const existingDate = await db.businessDate.findUnique({ where: { businessDate: requestedDate } })
    let targetRecord: any
    if (existingDate) {
      targetRecord = await db.businessDate.update({
        where: { id: existingDate.id },
        data: {
          status: 'OPEN',
          openedById: user.id,
          openingCash,
          closingCash: openingCash,
          reconciliationStatus: 'PENDING',
        },
      })
    } else {
      targetRecord = await db.businessDate.create({
        data: {
          businessDate: requestedDate,
          status: 'OPEN',
          openedById: user.id,
          openingCash,
          closingCash: openingCash,
          reconciliationStatus: 'PENDING',
        },
      })
    }

    await logAudit({
      user,
      action: 'BUSINESS_DATE_OPENED',
      entity: 'BUSINESS_DATE',
      entityId: targetRecord.id,
      newValue: { businessDate: targetRecord.businessDate, openingCash },
    })

    const summary = await getBusinessDateSummary(targetRecord.id)
    return json({ active: targetRecord, summary }, 201)
  })
}
