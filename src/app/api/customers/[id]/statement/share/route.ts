import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      select: { id: true, customerId: true, fullName: true },
    })

    if (!customer) return error('Customer not found.', 404)

    const body = await parseBody(req)
    const channel = body.channel || 'LINK' // LINK, WHATSAPP, EMAIL

    // Generate secure token with 7-day expiration
    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Store token in SystemSetting for security lookup
    await db.systemSetting.upsert({
      where: { key: `STATEMENT_SHARE_${token}` },
      update: { value: JSON.stringify({ customerId: id, expiresAt }) },
      create: { key: `STATEMENT_SHARE_${token}`, value: JSON.stringify({ customerId: id, expiresAt }) },
    })

    const shareUrl = `/statement/${token}`

    await logAudit({
      user,
      action: 'STATEMENT_SHARED',
      entity: 'CUSTOMER',
      entityId: id,
      newValue: { channel, token, customerId: customer.customerId },
      reason: `Shared statement via ${channel}`,
    })

    return json({
      success: true,
      shareUrl,
      token,
      expiresAt,
    })
  })
}
