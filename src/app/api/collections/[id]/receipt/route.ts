import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const collection = await db.collection.findUnique({ where: { id }, include: { receipt: true } })
    if (!collection) return error('Collection not found.', 404)
    if (!collection.receipt) return error('Receipt not found.', 404)

    const updated = await db.receipt.update({
      where: { id: collection.receipt.id },
      data: { printCount: { increment: 1 } },
    })
    await logAudit({ user, action: 'UPDATE', entity: 'RECEIPT', entityId: collection.receipt.id, newValue: { printCount: updated.printCount }, reason: 'Receipt reprint' })
    return json({ printCount: updated.printCount })
  })
}
