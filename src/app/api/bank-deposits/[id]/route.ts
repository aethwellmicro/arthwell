import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { num } from '@/lib/calc'
import { getBranchFilter } from '@/lib/branch'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (user) => {
    const { id } = await params
    const item = await db.bankDeposit.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: {
        businessDate: { select: { businessDate: true, status: true } },
        createdBy: { select: { name: true, employeeCode: true } },
      },
    })
    if (!item) return error('Bank deposit not found.', 404)

    return json({
      item: {
        ...item,
        amount: num(item.amount),
        depositDate: item.depositDate.toISOString().slice(0, 10),
        businessDate: item.businessDate.businessDate.toISOString().slice(0, 10),
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
    const item = await db.bankDeposit.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: { businessDate: true },
    })
    if (!item) return error('Bank deposit not found.', 404)

    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return error('Unauthorized to delete bank deposit records.', 403)
    }

    if (item.businessDate.status === 'CLOSED' && user.role !== 'ADMIN') {
      return error('Cannot delete a bank deposit belonging to a closed business date. Contact Administrator.', 422)
    }

    await db.bankDeposit.delete({ where: { id } })

    await logAudit({
      user,
      action: 'BANK_DEPOSIT_DELETED',
      entity: 'BANK_DEPOSIT',
      entityId: id,
      oldValue: {
        depositNumber: item.depositNumber,
        amount: num(item.amount),
        bankAccount: item.bankAccount,
        depositDate: item.depositDate,
      },
    })

    return json({ success: true, message: 'Bank deposit deleted successfully.' })
  })
}
