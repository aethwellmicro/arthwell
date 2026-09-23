import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { reopenBusinessDate } from '@/lib/business-date'
import { ROLE_ADMIN } from '@/lib/auth'

export async function POST(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Unauthorized. Only an Administrator can reopen a closed business date.', 403)
    }

    const body = await parseBody(req)
    const businessDateId = body.businessDateId ? String(body.businessDateId).trim() : ''
    const reason = body.reason ? String(body.reason).trim() : ''

    if (!businessDateId) {
      return error('Business date ID is required to reopen.', 422)
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
