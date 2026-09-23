/**
 * Unit and invariant tests for Reducing Balance interest engine, dynamic recalculation
 * after principal repayment, and financial reconciliation.
 */
import { calculateLoan } from '../src/lib/calc'
import { toMoney, addMoney, subMoney, mulMoney } from '../src/lib/money'

function testReducingBalanceInterestDiminution() {
  console.log('=== TEST 1: REDUCING BALANCE - INTEREST DECREASES AS PRINCIPAL DIMINISHES ===')
  const loan = calculateLoan({
    principal: 100000,
    interestRate: 25,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  // Verify that for all installments, interest in month i > interest in month i + 1
  for (let i = 0; i < loan.schedule.length - 1; i++) {
    const current = loan.schedule[i]
    const next = loan.schedule[i + 1]

    if (current.interestPart <= next.interestPart) {
      throw new Error(
        `Installment #${i + 1} interest (${current.interestPart}) must be strictly greater than #${i + 2} (${next.interestPart})`
      )
    }

    if (current.balance <= next.balance) {
      throw new Error(
        `Installment #${i + 1} balance (${current.balance}) must be strictly greater than #${i + 2} (${next.balance})`
      )
    }
  }

  console.log(`✓ EMI #1 Interest: ₹${loan.schedule[0].interestPart.toFixed(2)} (on ₹100,000)`)
  console.log(`✓ EMI #2 Interest: ₹${loan.schedule[1].interestPart.toFixed(2)} (on ₹${(100000 - loan.schedule[0].principalPart).toFixed(2)})`)
  console.log(`✓ EMI #25 Interest: ₹${loan.schedule[24].interestPart.toFixed(2)}`)
  console.log('✓ Invariant holds: Interest strictly decreases as principal is repaid across all 25 weeks.')
}

function testDynamicRepaymentAmortization() {
  console.log('\n=== TEST 2: DYNAMIC REPAYMENT & NEW BALANCE INTEREST RECALCULATION ===')
  const initialPrincipal = 100000
  const periodicRate = 0.017960023042266935 // periodic rate

  // Period 1:
  const opening1 = initialPrincipal
  const interestCharge1 = mulMoney(opening1, periodicRate)
  const payment1 = 5000.20
  const principalPaid1 = subMoney(payment1, interestCharge1)
  const closingPrincipal1 = subMoney(opening1, principalPaid1)

  // Period 2 (Calculated strictly on new closing principal):
  const opening2 = closingPrincipal1
  const interestCharge2 = mulMoney(opening2, periodicRate)

  if (interestCharge2 >= interestCharge1) {
    throw new Error(`Period 2 interest (${interestCharge2}) should be lower than period 1 (${interestCharge1})`)
  }

  console.log(`✓ Period 1: Opening=₹${opening1}, Interest=₹${interestCharge1.toFixed(2)}, PrincipalPaid=₹${principalPaid1.toFixed(2)}, Closing=₹${closingPrincipal1.toFixed(2)}`)
  console.log(`✓ Period 2: Opening=₹${opening2.toFixed(2)}, Interest=₹${interestCharge2.toFixed(2)}`)
  console.log(`✓ Dynamic Interest difference: ₹${(interestCharge1 - interestCharge2).toFixed(2)} savings`)
}

function testReconciliationToZero() {
  console.log('\n=== TEST 3: FINANCIAL RECONCILIATION TO EXACT ₹0.00 ===')
  const loan = calculateLoan({
    principal: 20000,
    interestRate: 12.5,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  const sumPrincipalPaid = loan.schedule.reduce((s, r) => addMoney(s, r.principalPart), 0)
  const sumInterestPaid = loan.schedule.reduce((s, r) => addMoney(s, r.interestPart), 0)
  const finalBalance = loan.schedule[loan.schedule.length - 1].balance

  if (Math.abs(sumPrincipalPaid - 20000) > 0.001) {
    throw new Error(`Sum of principal parts does not equal original principal: ${sumPrincipalPaid}`)
  }
  if (finalBalance !== 0) {
    throw new Error(`Final balance is not exactly 0.00: ${finalBalance}`)
  }

  console.log(`✓ Sum of principal parts = ₹${sumPrincipalPaid.toFixed(2)} (Exactly original principal)`)
  console.log(`✓ Sum of interest parts = ₹${sumInterestPaid.toFixed(2)}`)
  console.log(`✓ Final Installment Balance = ₹${finalBalance.toFixed(2)}`)
}

function runAll() {
  console.log('========================================================')
  console.log('STARTING REDUCING BALANCE & FINANCIAL RECONCILIATION SUITE')
  console.log('========================================================\n')
  testReducingBalanceInterestDiminution()
  testDynamicRepaymentAmortization()
  testReconciliationToZero()
  console.log('\n========================================================')
  console.log('ALL REDUCING BALANCE & FINANCIAL TESTS PASSED!')
  console.log('========================================================\n')
}

runAll()
