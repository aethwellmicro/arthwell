import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { num } from '@/lib/calc'
import { logAudit } from '@/lib/audit'
import crypto from 'crypto'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await ctx.params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        group: true,
        createdBy: { select: { id: true, name: true, employeeCode: true } },
        accounts: {
          include: {
            product: true,
            installments: { orderBy: { installNo: 'asc' } },
            collections: { where: { status: 'SUCCESSFUL' }, orderBy: { collectionDate: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) return error('Customer not found.', 404)

    // Aggregate transactions for the primary active account (or most recent)
    const activeAccount = customer.accounts.find((a) => a.status === 'ACTIVE') || customer.accounts[0] || null

    let totalPrincipal = 0
    let totalInterest = 0
    let totalPayable = 0
    let totalPaid = 0
    let totalSavingsPaid = 0
    let outstanding = 0

    if (activeAccount) {
      totalPrincipal = num(activeAccount.principal)
      totalInterest = num(activeAccount.totalInterest)
      totalPayable = num(activeAccount.totalPayable)
      totalPaid = activeAccount.collections.reduce((s, c) => s + num(c.amount), 0)
      outstanding = Math.max(totalPayable - totalPaid, 0)
      totalSavingsPaid = activeAccount.installments.reduce((s, i) => s + num(i.paidSavings), 0)
    }

    const statement = {
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        primaryMobile: customer.primaryMobile,
        branch: customer.branch,
        group: customer.group ? `${customer.group.groupId} - ${customer.group.name}` : '—',
        fieldOfficer: customer.createdBy?.name || '—',
      },
      account: activeAccount
        ? {
            id: activeAccount.id,
            accountNumber: activeAccount.accountNumber,
            productName: activeAccount.product?.name || 'Standard Loan',
            principal: totalPrincipal,
            interestRate: num(activeAccount.interestRate),
            interestType: activeAccount.interestType,
            interestPeriod: activeAccount.interestPeriod,
            tenure: activeAccount.tenure,
            frequency: activeAccount.installmentFreq,
            emiAmount: num(activeAccount.installmentAmount),
            savingsAmount: num(activeAccount.savingsAmount),
            processingFee: num(activeAccount.processingFee),
            insurancePremium: num(activeAccount.insurancePremium),
            totalFees: num(activeAccount.processingFee) + num(activeAccount.insurancePremium),
            totalInterest,
            totalPayable,
            totalPaid,
            outstanding,
            totalSavingsPaid,
            startDate: activeAccount.startDate.toISOString().slice(0, 10),
            firstDueDate: activeAccount.firstDueDate.toISOString().slice(0, 10),
            maturityDate: activeAccount.maturityDate.toISOString().slice(0, 10),
            status: activeAccount.status,
          }
        : null,
      schedule: activeAccount
        ? activeAccount.installments.map((i) => ({
            installNo: i.installNo,
            dueDate: i.dueDate.toISOString().slice(0, 10),
            amount: num(i.amount),
            principalPart: num(i.principalPart),
            interestPart: num(i.interestPart),
            savingsPart: num(i.savingsPart),
            paidAmount: num(i.paidAmount),
            paidSavings: num(i.paidSavings),
            balance: num(i.balance),
            status: i.status,
          }))
        : [],
      transactions: activeAccount
        ? activeAccount.collections.map((c) => ({
            id: c.id,
            receiptNumber: c.receiptNumber,
            date: c.collectionDate.toISOString().slice(0, 10),
            amount: num(c.amount),
            debit: 0,
            credit: num(c.amount),
            side: 'CREDIT',
            particulars: 'EMI Collection Received',
            paymentMode: c.paymentMode,
            previousOutstanding: num(c.previousOutstanding),
            currentOutstanding: num(c.currentOutstanding),
            status: c.status,
          }))
        : [],
      ledgerEntries: activeAccount
        ? [
            // 1. Loan Disbursement: Debit
            {
              date: activeAccount.startDate.toISOString().slice(0, 10),
              particulars: `Loan Sanction & Disbursement (${activeAccount.product?.name || 'Loan'})`,
              receiptNumber: activeAccount.accountNumber,
              accountNumber: activeAccount.accountNumber,
              debit: totalPrincipal,
              credit: 0,
              side: 'DEBIT',
              paymentMode: 'DISBURSEMENT',
              collectedBy: customer.createdBy?.name || 'Branch Office',
              balanceAfter: totalPrincipal,
              status: 'DISBURSED',
            },
            // 2. Upfront Deducted / Recovered Charges: Credit side
            ...(num(activeAccount.processingFee) + num(activeAccount.insurancePremium) > 0
              ? [
                  {
                    date: activeAccount.startDate.toISOString().slice(0, 10),
                    particulars: `Recovered Charges (Proc Fee: ₹${num(activeAccount.processingFee)} + Insurance: ₹${num(activeAccount.insurancePremium)})`,
                    receiptNumber: 'CHG-' + activeAccount.accountNumber.slice(-4),
                    accountNumber: activeAccount.accountNumber,
                    debit: 0,
                    credit: num(activeAccount.processingFee) + num(activeAccount.insurancePremium),
                    side: 'CREDIT',
                    paymentMode: 'DEDUCTION',
                    collectedBy: customer.createdBy?.name || 'Auto Deduction',
                    balanceAfter: totalPrincipal,
                    status: 'RECOVERED',
                  },
                ]
              : []),
            // 3. Collections: Credit side
            ...activeAccount.collections.map((c) => ({
              date: c.collectionDate.toISOString().slice(0, 10),
              particulars: 'EMI Repayment Received',
              receiptNumber: c.receiptNumber,
              accountNumber: activeAccount.accountNumber,
              debit: 0,
              credit: num(c.amount),
              side: 'CREDIT',
              paymentMode: c.paymentMode,
              collectedBy: customer.createdBy?.name || 'Field Officer',
              balanceAfter: num(c.currentOutstanding),
              status: c.status,
            })),
          ]
        : [],
    }

    return json(statement)
  })
}
