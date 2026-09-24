import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params
    const item = await db.expense.findUnique({
      where: { id },
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { name: true, role: true } },
      },
    })
    if (!item) return error('Expense not found.', 404)

    return json({
      item: {
        ...item,
        amount: num(item.amount),
        expenseDate: item.expenseDate.toISOString().slice(0, 10),
        businessDate: item.businessDate.businessDate.toISOString().slice(0, 10),
      },
    })
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    const { id } = await params
    const item = await db.expense.findUnique({ where: { id } })
    if (!item) return error('Expense not found.', 404)

    const body = await parseBody(req)
    const updateData: any = {}

    if (body.status !== undefined) updateData.status = String(body.status)
    if (body.remarks !== undefined) updateData.remarks = String(body.remarks)
    if (body.particulars !== undefined) updateData.particulars = String(body.particulars)

    const updated = await db.expense.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      user,
      action: 'EXPENSE_UPDATED',
      entity: 'EXPENSE',
      entityId: id,
      oldValue: { status: item.status },
      newValue: updateData,
      reason: `Updated expense ${item.expenseNumber}`,
    })

    return json({
      success: true,
      message: 'Expense updated successfully.',
      item: {
        ...updated,
        amount: num(updated.amount),
      },
    })
  })
}
