import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num, parseCalendarDate } from '@/lib/calc'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params
    const item = await db.investment.findUnique({
      where: { id },
      include: {
        businessDate: { select: { businessDate: true } },
        createdBy: { select: { name: true, role: true } },
      },
    })
    if (!item) return error('Investment not found.', 404)

    return json({
      item: {
        ...item,
        amount: num(item.amount),
        interestRate: item.interestRate ? num(item.interestRate) : null,
        interestPaid: num(item.interestPaid),
        investmentDate: item.investmentDate.toISOString().slice(0, 10),
        maturityDate: item.maturityDate ? item.maturityDate.toISOString().slice(0, 10) : null,
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
    const item = await db.investment.findUnique({ where: { id } })
    if (!item) return error('Investment not found.', 404)

    const body = await parseBody(req)
    const updateData: any = {}

    if (body.status !== undefined) updateData.status = String(body.status)
    if (body.remarks !== undefined) updateData.remarks = String(body.remarks)
    if (body.interestPaid !== undefined) {
      const addedInterest = parseFloat(body.interestPaid)
      if (!isNaN(addedInterest)) {
        updateData.interestPaid = num(item.interestPaid) + addedInterest
      }
    }
    if (body.maturityDate !== undefined) {
      updateData.maturityDate = body.maturityDate ? parseCalendarDate(body.maturityDate) : null
    }

    const updated = await db.investment.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      user,
      action: 'INVESTMENT_UPDATED',
      entity: 'INVESTMENT',
      entityId: id,
      oldValue: { status: item.status, interestPaid: num(item.interestPaid) },
      newValue: updateData,
      reason: `Updated investment ${item.investmentNumber}`,
    })

    return json({
      success: true,
      message: 'Investment updated successfully.',
      item: {
        ...updated,
        amount: num(updated.amount),
        interestRate: updated.interestRate ? num(updated.interestRate) : null,
        interestPaid: num(updated.interestPaid),
      },
    })
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    const { id } = await params
    const item = await db.investment.findUnique({
      where: { id },
      include: { businessDate: true },
    })
    if (!item) return error('Investment not found.', 404)

    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return error('Unauthorized to delete investment entries.', 403)
    }

    if (item.businessDate.status === 'CLOSED' && user.role !== 'ADMIN') {
      return error('Cannot delete an investment from a closed business date. Contact Administrator.', 422)
    }

    await db.investment.delete({ where: { id } })

    await logAudit({
      user,
      action: 'INVESTMENT_DELETED',
      entity: 'INVESTMENT',
      entityId: id,
      oldValue: {
        investmentNumber: item.investmentNumber,
        amount: num(item.amount),
        investorName: item.investorName,
        investmentType: item.investmentType,
      },
    })

    return json({ success: true, message: 'Investment deleted successfully.' })
  })
}
