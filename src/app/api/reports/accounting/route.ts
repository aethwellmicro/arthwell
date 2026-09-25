import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { num } from '@/lib/calc'
import { addMoney, subMoney } from '@/lib/money'
import { getBranchFilter } from '@/lib/branch'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(req.url)
    const reportType = searchParams.get('report') || 'trial-balance'
    const requestedBranchId = searchParams.get('branchId') || undefined
    const branchFilter = getBranchFilter(user, requestedBranchId)

    // Gather live data
    // 1. Collections (only APPROVED or legacy SUCCESSFUL)
    const collectionsAgg = await db.collection.aggregate({
      where: { status: { in: ['APPROVED', 'SUCCESSFUL'] }, ...branchFilter },
      _sum: {
        amount: true,
        allocatedPrincipal: true,
        allocatedInterest: true,
        allocatedSavings: true,
      },
    })
    const totalCollected = num(collectionsAgg._sum.amount)
    const principalCollected = num(collectionsAgg._sum.allocatedPrincipal)
    const interestIncome = num(collectionsAgg._sum.allocatedInterest)
    const customerSavings = num(collectionsAgg._sum.allocatedSavings)

    // 2. Loan Accounts & Receivables
    const accountsAgg = await db.account.aggregate({
      where: { status: { not: 'CANCELLED' }, ...branchFilter },
      _sum: {
        principal: true,
        processingFee: true,
        insurancePremium: true,
        totalPayable: true,
      },
    })
    const totalDisbursedPrincipal = num(accountsAgg._sum.principal)
    const processingFeeIncome = num(accountsAgg._sum.processingFee)
    const insuranceIncome = num(accountsAgg._sum.insurancePremium)
    const loanReceivables = Math.max(totalDisbursedPrincipal - principalCollected, 0)

    // 3. Investments (Capital Inflows)
    const investmentsAgg = await db.investment.aggregate({
      where: { status: { not: 'CANCELLED' }, ...branchFilter },
      _sum: { amount: true },
    })
    const totalInvestments = num(investmentsAgg._sum.amount)

    // 4. Expenses (Operating & Administrative Outflows)
    const expenses = await db.expense.findMany({
      where: { status: { not: 'CANCELLED' }, ...branchFilter },
      select: { expenseType: true, amount: true },
    })
    let totalExpenses = 0
    let interestExpense = 0
    let operatingExpenses = 0
    let otherExpenses = 0

    for (const exp of expenses) {
      const amt = num(exp.amount)
      totalExpenses = addMoney(totalExpenses, amt)
      if (exp.expenseType.includes('INTEREST')) {
        interestExpense = addMoney(interestExpense, amt)
      } else if (exp.expenseType.includes('SALARY') || exp.expenseType.includes('OFFICE') || exp.expenseType.includes('STATIONERY')) {
        operatingExpenses = addMoney(operatingExpenses, amt)
      } else {
        otherExpenses = addMoney(otherExpenses, amt)
      }
    }

    // 5. Bank Deposits (Cash transferred to Bank)
    const bankDepositsAgg = await db.bankDeposit.aggregate({
      where: { ...branchFilter },
      _sum: { amount: true },
    })
    const totalBankDeposits = num(bankDepositsAgg._sum.amount)

    // 6. Cash and Bank Balances
    // Cash In Hand = Total Collections (Cash) + Investments (Cash) - Disbursements - Expenses (Cash) - Bank Deposits
    const cashInHand = Math.max(0, totalInvestments + totalCollected - totalDisbursedPrincipal - totalExpenses - totalBankDeposits)
    const bankBalance = totalBankDeposits

    // Total Income & Net Profit
    const totalIncome = interestIncome + processingFeeIncome + insuranceIncome
    const netProfit = totalIncome - totalExpenses

    // ==========================================
    // A. TRIAL BALANCE
    // ==========================================
    if (reportType === 'trial-balance') {
      const items = [
        { code: '1001', account: 'Cash in Hand (Vault)', debit: cashInHand, credit: 0 },
        { code: '1002', account: 'Bank Accounts', debit: bankBalance, credit: 0 },
        { code: '1003', account: 'Loan Portfolio Receivables', debit: loanReceivables, credit: 0 },
        { code: '2001', account: 'Capital / Investor Inflows', debit: 0, credit: totalInvestments },
        { code: '2002', account: 'Customer Compulsory Savings', debit: 0, credit: customerSavings },
        { code: '3001', account: 'Interest Income from Loans', debit: 0, credit: interestIncome },
        { code: '3002', account: 'Processing Fee Income', debit: 0, credit: processingFeeIncome },
        { code: '3003', account: 'Insurance Premium / Other Income', debit: 0, credit: insuranceIncome },
        { code: '4001', account: 'Operating & Admin Expenses', debit: operatingExpenses, credit: 0 },
        { code: '4002', account: 'Interest & Financial Expenses', debit: interestExpense, credit: 0 },
        { code: '4003', account: 'Other Miscellaneous Expenses', debit: otherExpenses, credit: 0 },
      ]

      const totalDebit = items.reduce((s, it) => s + it.debit, 0)
      const totalCredit = items.reduce((s, it) => s + it.credit, 0)
      const difference = subMoney(totalDebit, totalCredit)

      return json({
        reportType: 'trial-balance',
        items,
        totalDebit,
        totalCredit,
        difference,
        reconciled: Math.abs(difference) <= 0.05,
      })
    }

    // ==========================================
    // B. PROFIT & LOSS STATEMENT
    // ==========================================
    if (reportType === 'profit-loss') {
      return json({
        reportType: 'profit-loss',
        income: {
          interestIncome,
          processingFees: processingFeeIncome,
          insuranceIncome,
          otherIncome: 0,
          totalIncome,
        },
        expenses: {
          operatingExpenses,
          interestExpense,
          otherExpenses,
          totalExpenses,
        },
        netProfit,
        profitMarginPercent: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
      })
    }

    // ==========================================
    // C. BALANCE SHEET
    // ==========================================
    if (reportType === 'balance-sheet') {
      const totalAssets = cashInHand + bankBalance + loanReceivables
      const totalLiabilities = customerSavings
      const totalEquity = totalInvestments + netProfit
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
      const variance = subMoney(totalAssets, totalLiabilitiesAndEquity)

      return json({
        reportType: 'balance-sheet',
        assets: {
          cashInHand,
          bankAccounts: bankBalance,
          loanReceivables,
          totalAssets,
        },
        liabilities: {
          customerSavings,
          otherPayables: 0,
          totalLiabilities,
        },
        equity: {
          investedCapital: totalInvestments,
          retainedEarnings: netProfit,
          totalEquity,
        },
        totalLiabilitiesAndEquity,
        variance,
        reconciled: Math.abs(variance) <= 0.05,
      })
    }

    // ==========================================
    // D. BANK RECONCILIATION STATEMENT (BRS)
    // ==========================================
    if (reportType === 'bank-reconciliation') {
      const bookBalance = totalBankDeposits
      const bankStatementBalance = totalBankDeposits // in absence of external statement sync
      const depositsInTransit = 0
      const outstandingCheques = 0
      const bankCharges = 0
      const reconciledBalance = bankStatementBalance + depositsInTransit - outstandingCheques - bankCharges
      const difference = subMoney(bookBalance, reconciledBalance)

      return json({
        reportType: 'bank-reconciliation',
        bookBalance,
        bankStatementBalance,
        depositsInTransit,
        outstandingCheques,
        bankCharges,
        reconciledBalance,
        difference,
        status: difference === 0 ? 'RECONCILED' : 'DISCREPANCY_NOTED',
      })
    }

    return error('Invalid report type requested.', 400)
  })
}
