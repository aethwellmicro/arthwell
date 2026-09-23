import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { calculateLoan } from '@/lib/calc'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const p = await db.loanProduct.findUnique({ where: { id } })
    if (!p) return error('Loan product not found.', 404)
    return json({
      ...p,
      principal: Number(p.principal),
      interestRate: Number(p.interestRate),
      emiAmount: Number(p.emiAmount),
      savingsAmount: Number(p.savingsAmount),
      processingFee: Number(p.processingFee),
      insurancePremium: Number(p.insurancePremium),
      totalFees: Number(p.processingFee) + Number(p.insurancePremium),
      totalWeeklyCollection: Number(p.emiAmount) + Number(p.savingsAmount),
    })
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Unauthorized to modify loan products.', 403)
    }
    const { id } = await ctx.params
    const existing = await db.loanProduct.findUnique({ where: { id } })
    if (!existing) return error('Loan product not found.', 404)

    const body = await parseBody(req)
    const data: any = {}
    if (body.name) data.name = body.name.trim()
    if (body.loanType) data.loanType = body.loanType
    if (body.principal !== undefined) data.principal = parseFloat(body.principal)
    if (body.interestRate !== undefined) data.interestRate = parseFloat(body.interestRate)
    if (body.interestBasis) data.interestBasis = body.interestBasis
    if (body.interestMethod) data.interestMethod = body.interestMethod
    if (body.tenure !== undefined) data.tenure = parseInt(body.tenure)
    if (body.frequency) data.frequency = body.frequency
    if (body.savingsAmount !== undefined) data.savingsAmount = parseFloat(body.savingsAmount)
    if (body.processingFee !== undefined) data.processingFee = parseFloat(body.processingFee)
    if (body.insurancePremium !== undefined) data.insurancePremium = parseFloat(body.insurancePremium)
    if (body.status) data.status = body.status

    if (data.principal || data.interestRate || data.tenure || data.interestBasis || data.interestMethod || data.frequency) {
      const computed = calculateLoan({
        principal: data.principal ?? Number(existing.principal),
        interestRate: data.interestRate ?? Number(existing.interestRate),
        interestType: (data.interestMethod ?? existing.interestMethod) as any,
        interestPeriod: (data.interestBasis ?? existing.interestBasis) as any,
        tenure: data.tenure ?? existing.tenure,
        installmentFreq: (data.frequency ?? existing.frequency) as any,
        startDate: new Date(),
      })
      data.emiAmount = computed.installmentAmount
    }

    const updated = await db.loanProduct.update({
      where: { id },
      data,
    })

    await logAudit({
      user,
      action: 'PRODUCT_UPDATED',
      entity: 'LOAN_PRODUCT',
      entityId: id,
      oldValue: existing,
      newValue: data,
    })

    return json({
      ...updated,
      principal: Number(updated.principal),
      interestRate: Number(updated.interestRate),
      emiAmount: Number(updated.emiAmount),
      savingsAmount: Number(updated.savingsAmount),
      processingFee: Number(updated.processingFee),
      insurancePremium: Number(updated.insurancePremium),
      totalFees: Number(updated.processingFee) + Number(updated.insurancePremium),
      totalWeeklyCollection: Number(updated.emiAmount) + Number(updated.savingsAmount),
    })
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN) {
      return error('Only an Administrator can delete or archive loan products.', 403)
    }
    const { id } = await ctx.params
    const accountsCount = await db.account.count({ where: { productId: id } })
    if (accountsCount > 0) {
      return error('Cannot delete product because active loan accounts are linked to it. Change its status to INACTIVE instead.', 422)
    }
    await db.loanProduct.delete({ where: { id } })
    return json({ success: true, message: 'Loan product deleted successfully.' })
  })
}
