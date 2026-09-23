import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { num } from '@/lib/calc'
import { CustomerStatementClient } from './statement-client'

export const dynamic = 'force-dynamic'

export default async function SharedStatementPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Verify token from system settings
  const setting = await db.systemSetting.findUnique({
    where: { key: `STATEMENT_SHARE_${token}` },
  })

  if (!setting) {
    notFound()
  }

  let payload: { customerId: string; expiresAt: string }
  try {
    payload = JSON.parse(setting.value)
  } catch {
    notFound()
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <div className="max-w-md w-full bg-card border rounded-lg p-6 text-center space-y-3">
          <h2 className="text-xl font-bold text-destructive">Statement Link Expired</h2>
          <p className="text-sm text-muted-foreground">
            This customer statement link has expired. Please contact the branch office or loan officer to obtain a fresh statement.
          </p>
        </div>
      </div>
    )
  }

  const customer = await db.customer.findUnique({
    where: { id: payload.customerId },
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

  if (!customer) {
    notFound()
  }

  const activeAccount = customer.accounts.find((a) => a.status === 'ACTIVE') || customer.accounts[0] || null

  let totalPrincipal = 0
  let totalInterest = 0
  let totalPayable = 0
  let totalPaid = 0
  let outstanding = 0

  if (activeAccount) {
    totalPrincipal = num(activeAccount.principal)
    totalInterest = num(activeAccount.totalInterest)
    totalPayable = num(activeAccount.totalPayable)
    totalPaid = activeAccount.collections.reduce((s, c) => s + num(c.amount), 0)
    outstanding = Math.max(totalPayable - totalPaid, 0)
  }

  // Build entries for the statement with Credit/Debit breakdown
  const entries: any[] = []

  if (activeAccount) {
    // 1. Loan Disbursement: Debit
    entries.push({
      date: activeAccount.startDate.toISOString(),
      particulars: `Loan Disbursement (${activeAccount.product?.name || 'Standard Loan'})`,
      receiptNumber: activeAccount.accountNumber,
      accountNumber: activeAccount.accountNumber,
      debit: totalPrincipal,
      credit: 0,
      balanceAfter: totalPrincipal,
      paymentMode: 'DISBURSEMENT',
      collectedBy: customer.createdBy?.name || 'Branch Office',
      status: 'DISBURSED',
    })

    // 2. Upfront Deducted / Recovered Charges: Credit
    const procFee = num(activeAccount.processingFee)
    const insPrem = num(activeAccount.insurancePremium)
    const recoveredCharges = procFee + insPrem

    if (recoveredCharges > 0) {
      entries.push({
        date: activeAccount.startDate.toISOString(),
        particulars: `Recovered Charges (Proc Fee: ₹${procFee} + Ins: ₹${insPrem})`,
        receiptNumber: 'CHG-' + activeAccount.accountNumber.slice(-4),
        accountNumber: activeAccount.accountNumber,
        debit: 0,
        credit: recoveredCharges,
        balanceAfter: totalPrincipal,
        paymentMode: 'DEDUCTION',
        collectedBy: customer.createdBy?.name || 'System / Auto',
        status: 'RECOVERED',
      })
    }

    // 3. Collections / Repayments: Credit
    let runningBal = totalPayable
    for (const c of activeAccount.collections) {
      const amt = num(c.amount)
      runningBal = Math.max(0, runningBal - amt)
      entries.push({
        date: c.collectionDate.toISOString(),
        particulars: `EMI Repayment Received`,
        receiptNumber: c.receiptNumber,
        accountNumber: activeAccount.accountNumber,
        debit: 0,
        credit: amt,
        balanceAfter: num(c.currentOutstanding) || runningBal,
        paymentMode: c.paymentMode,
        collectedBy: customer.createdBy?.name || 'Field Officer',
        status: c.status,
      })
    }
  }

  return (
    <CustomerStatementClient
      customer={{
        customerId: customer.customerId,
        fullName: customer.fullName,
        primaryMobile: customer.primaryMobile,
        area: customer.area,
        city: customer.city,
        address: customer.address,
        amount: customer.amount ? num(customer.amount) : null,
      }}
      account={
        activeAccount
          ? {
              accountNumber: activeAccount.accountNumber,
              principal: totalPrincipal,
              processingFee: num(activeAccount.processingFee),
              insurancePremium: num(activeAccount.insurancePremium),
              totalFees: num(activeAccount.processingFee) + num(activeAccount.insurancePremium),
            }
          : undefined
      }
      totalPayable={totalPayable}
      totalCollected={totalPaid}
      outstanding={outstanding}
      entries={entries}
      branchName={customer.branch || 'Main Branch - MG Road'}
    />
  )
}
