import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { reopenBusinessDate } from '@/lib/business-date'
import { ROLE_ADMIN } from '@/lib/auth'
import { parseCalendarDate } from '@/lib/calc'

export async function POST(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Unauthorized. Only an Administrator can reopen a closed business date.', 403)
    }

    const body = await parseBody(req)
    let businessDateId = body.businessDateId ? String(body.businessDateId).trim() : ''
    const businessDateStr = body.businessDate ? String(body.businessDate).trim() : ''
    const reason = body.reason ? String(body.reason).trim() : ''

    // 1. If no ID provided, try multiple lookup strategies using businessDateStr or fallback to latest closed
    if (!businessDateId && businessDateStr) {
      // First try exact calendar date match (using system noon convention)
      const parsedExact = parseCalendarDate(businessDateStr)
      let found = await db.businessDate.findFirst({
        where: { businessDate: parsedExact },
      })

      // If not found, try flexible start-of-day to end-of-day window (covering both UTC and local offsets)
      if (!found) {
        const dateObj = new Date(businessDateStr)
        if (!isNaN(dateObj.getTime())) {
          const dateOnly = businessDateStr.slice(0, 10)
          const startOfDayUtc = new Date(dateOnly + 'T00:00:00.000Z')
          const endOfDayUtc = new Date(dateOnly + 'T23:59:59.999Z')
          // Broader 36-hour window around the date to eliminate any timezone drift
          const broadStart = new Date(startOfDayUtc.getTime() - 14 * 60 * 60 * 1000)
          const broadEnd = new Date(endOfDayUtc.getTime() + 14 * 60 * 60 * 1000)

          found = await db.businessDate.findFirst({
            where: {
              businessDate: {
                gte: broadStart,
                lte: broadEnd,
              },
            },
            orderBy: { businessDate: 'desc' },
          })
        }
      }

      if (found) {
        if (found.status === 'OPEN' || found.status === 'REOPENED') {
          return json({
            message: `Business date ${businessDateStr} is already OPEN.`,
            businessDate: found,
          })
        }
        businessDateId = found.id
      } else {
        const parsedDate = parseCalendarDate(businessDateStr)
        const newBDate = await db.businessDate.create({
          data: {
            businessDate: parsedDate,
            status: 'OPEN',
            openedById: user.id,
            openingCash: 0,
            closingCash: 0,
            reconciliationStatus: 'PENDING',
          },
        })
        return json({
          message: `Business date ${businessDateStr} created and opened successfully.`,
          businessDate: newBDate,
        })
      }
    }

    // 2. If neither ID nor date was explicitly provided, fallback to the most recent CLOSED business date
    if (!businessDateId && !businessDateStr) {
      const latestClosed = await db.businessDate.findFirst({
        where: { status: 'CLOSED' },
        orderBy: { businessDate: 'desc' },
      })
      if (latestClosed) {
        businessDateId = latestClosed.id
      }
    }

    if (!businessDateId) {
      return error('Business date ID or valid date is required to reopen.', 422)
    }
    if (!reason) {
      return error('A mandatory reason is required to reopen a closed business date.', 422)
    }

    try {
      const reopened = await reopenBusinessDate({
        user,
        businessDateId,
        reason,
      })

      return json({
        success: true,
        message: `Business date ${reopened.businessDate.toISOString().slice(0, 10)} has been REOPENED for controlled corrections. Reason: ${reason}.`,
        businessDate: {
          ...reopened,
          businessDate: reopened.businessDate.toISOString().slice(0, 10),
        },
      })
    } catch (e: any) {
      return error(e.message, 422)
    }
  })
}
