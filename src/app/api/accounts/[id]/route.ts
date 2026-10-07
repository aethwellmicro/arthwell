import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getBranchFilter } from '@/lib/branch'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const account = await db.account.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: { customer: true, product: true, createdBy: { select: { name: true } } },
    })
    if (!account) return error('Account not found.', 404)

    const collected = await db.collection.aggregate({
      where: { accountId: id, status: 'SUCCESSFUL' },
      _sum: { amount: true },
    })
    const paid = Number(collected._sum.amount || 0)
    const totalPayable = Number(account.totalPayable)

    const installments = await db.installment.findMany({
      where: { accountId: id },
      orderBy: { installNo: 'asc' },
    })

    return json({
      ...account,
      principal: Number(account.principal),
      interestRate: Number(account.interestRate),
      installmentAmount: Number(account.installmentAmount),
      savingsAmount: Number(account.savingsAmount || 0),
      processingFee: Number(account.processingFee || 0),
      insurancePremium: Number(account.insurancePremium || 0),
      totalFees: Number(account.processingFee || 0) + Number(account.insurancePremium || 0),
      totalPayable,
      totalInterest: Number(account.totalInterest),
      paidAmount: paid,
      outstanding: Math.max(totalPayable - paid, 0),
      installments: installments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        savingsPart: Number(i.savingsPart || 0),
        paidAmount: Number(i.paidAmount),
        paidSavings: Number(i.paidSavings || 0),
      })),
    })
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const existing = await db.account.findFirst({ where: { id, ...getBranchFilter(user) } })
    if (!existing) return error('Account not found.', 404)

    const data: any = {}
    for (const k of ['status', 'remarks']) {
      if (body[k] !== undefined) data[k] = body[k] === '' ? null : body[k]
    }
    const updated = await db.account.update({ where: { id }, data })
    return json({ ...updated, principal: Number(updated.principal), totalPayable: Number(updated.totalPayable) })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    if (user.role !== 'ADMIN' && user.role !== 'BRANCH_MANAGER') {
      return error('Unauthorized to delete loan accounts.', 403)
    }

    const { id } = await ctx.params
    const account = await db.account.findFirst({
      where: { id, ...getBranchFilter(user) },
      include: {
        customer: true,
        collections: {
          select: { id: true, receiptNumber: true, status: true },
        },
      },
    })

    if (!account) return error('Account not found.', 404)

    // Check if account has any successful collections
    const activeCollections = account.collections.filter(
      (c) => c.status === 'SUCCESSFUL' || c.status === 'APPROVED'
    )

    if (activeCollections.length > 0 && user.role !== 'ADMIN') {
      return error(
        `Cannot delete loan account ${account.accountNumber} because it has ${activeCollections.length} approved collection payments. Contact Administrator.`,
        422
      )
    }

    await db.$transaction(async (tx) => {
      // 1. Delete associated receipts and notifications linked to collections of this account
      for (const col of account.collections) {
        await tx.receipt.deleteMany({ where: { collectionId: col.id } })
        await tx.notification.deleteMany({ where: { collectionId: col.id } })
      }

      // 2. Delete collections
      await tx.collection.deleteMany({ where: { accountId: id } })

      // 3. Delete installments
      await tx.installment.deleteMany({ where: { accountId: id } })

      // 4. Delete the account
      await tx.account.delete({ where: { id } })

      // 5. Update customer status if they have no other accounts
      const remainingAccounts = await tx.account.count({ where: { customerId: account.customerId } })
      if (remainingAccounts === 0) {
        await tx.customer.update({
          where: { id: account.customerId },
          data: { status: 'APPROVED' },
        })
      }
    })

    await logAudit({
      user,
      action: 'ACCOUNT_DELETED',
      entity: 'ACCOUNT',
      entityId: id,
      oldValue: {
        accountNumber: account.accountNumber,
        customer: account.customer.fullName,
        principal: Number(account.principal),
        totalPayable: Number(account.totalPayable),
      },
    })

    return json({ success: true, message: `Account ${account.accountNumber} deleted successfully.` })
  })
}
