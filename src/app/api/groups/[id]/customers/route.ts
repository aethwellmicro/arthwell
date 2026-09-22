import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const group = await db.group.findUnique({
      where: { id },
      select: { id: true, groupId: true, name: true, branch: true },
    })
    if (!group) return error('Group not found.', 404)

    const customers = await db.customer.findMany({
      where: { groupId: id },
      include: {
        createdBy: { select: { id: true, name: true } },
        accounts: { select: { id: true, accountNumber: true, status: true, totalPayable: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return json({ group, customers })
  })
}
