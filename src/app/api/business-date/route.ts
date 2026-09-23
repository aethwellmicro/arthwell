import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { getActiveBusinessDate, getBusinessDateSummary } from '@/lib/business-date'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { parseCalendarDate } from '@/lib/calc'

export async function GET() {
  return withAuth(async (user) => {
    const active = await getActiveBusinessDate(user)
    if (!active) {
      return json({ active: null, summary: null })
    }
    const summary = await getBusinessDateSummary(active.id)
    return json({ active, summary })
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
      // If updating opening cash for the existing open date
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

    // Otherwise create initial business date
    const created = await db.businessDate.create({
      data: {
        businessDate: requestedDate,
        status: 'OPEN',
        openedById: user.id,
        openingCash,
        closingCash: openingCash,
        reconciliationStatus: 'PENDING',
      },
    })

    await logAudit({
      user,
      action: 'BUSINESS_DATE_OPENED',
      entity: 'BUSINESS_DATE',
      entityId: created.id,
      newValue: { businessDate: created.businessDate, openingCash },
    })

    const summary = await getBusinessDateSummary(created.id)
    return json({ active: created, summary }, 201)
  })
}
