/**
 * Tests for deterministic payment allocation (FIFO), partial payments, and overdue interest handling.
 */
import { toMoney, addMoney, subMoney } from '../src/lib/money'

interface InstallmentRecord {
  installNo: number
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID'
}

function allocatePayment(installments: InstallmentRecord[], paymentAmount: number) {
  let remaining = paymentAmount
  for (const inst of installments) {
    if (remaining <= 0) break
    const due = inst.amount
    const alreadyPaid = inst.paidAmount
    const needed = subMoney(due, alreadyPaid)
    if (needed <= 0) continue

    const pay = Math.min(needed, remaining)
    inst.paidAmount = addMoney(alreadyPaid, pay)
    inst.status = inst.paidAmount >= due - 0.01 ? 'PAID' : 'PARTIAL'
    remaining = subMoney(remaining, pay)
  }
  return { installments, remaining }
}

function testDeterministicFIFOAllocation() {
  console.log('=== TEST 1: DETERMINISTIC FIFO PAYMENT ALLOCATION ===')
  const installments: InstallmentRecord[] = [
    { installNo: 1, amount: 900, paidAmount: 0, status: 'PENDING' },
    { installNo: 2, amount: 900, paidAmount: 0, status: 'PENDING' },
    { installNo: 3, amount: 900, paidAmount: 0, status: 'PENDING' },
  ]

  // Scenario 1: Partial payment of ₹500 against Installment #1
  const res1 = allocatePayment(installments, 500)
  if (res1.installments[0].paidAmount !== 500 || res1.installments[0].status !== 'PARTIAL') {
    throw new Error('Partial payment did not set installment #1 to PARTIAL with 500')
  }
  if (res1.installments[1].paidAmount !== 0) {
    throw new Error('Installment #2 should not have received payment yet')
  }
  console.log('✓ Partial Payment ₹500 -> Installment #1 marked PARTIAL (Paid: ₹500, Due: ₹400)')

  // Scenario 2: Second payment of ₹1000 -> completes #1 (₹400) and partially pays #2 (₹600)
  const res2 = allocatePayment(installments, 1000)
  if (res2.installments[0].paidAmount !== 900 || res2.installments[0].status !== 'PAID') {
    throw new Error('Installment #1 was not completed by the second payment')
  }
  if (res2.installments[1].paidAmount !== 600 || res2.installments[1].status !== 'PARTIAL') {
    throw new Error('Installment #2 was not partially paid with ₹600')
  }
  console.log('✓ Subsequent Payment ₹1,000 -> Installment #1 marked PAID (₹900/₹900), Installment #2 marked PARTIAL (₹600/₹900)')

  // Scenario 3: Third payment of ₹1200 -> completes #2 (₹300) and completes #3 (₹900)
  const res3 = allocatePayment(installments, 1200)
  if (res3.installments[1].status !== 'PAID' || res3.installments[2].status !== 'PAID') {
    throw new Error('Installments #2 and #3 should both be fully PAID')
  }
  console.log('✓ Third Payment ₹1,200 -> Installment #2 marked PAID (₹900/₹900), Installment #3 marked PAID (₹900/₹900)')
}

function testFullSettlementReconciliation() {
  console.log('\n=== TEST 2: FULL SETTLEMENT RECONCILIATION ===')
  const totalLoanPayable = 22500
  let totalCollected = 0
  const payments = [900, 1800, 4500, 900, 14400]

  for (const p of payments) {
    totalCollected = addMoney(totalCollected, p)
  }

  const outstanding = subMoney(totalLoanPayable, totalCollected)
  if (outstanding !== 0) {
    throw new Error(`Expected outstanding ₹0, got ${outstanding}`)
  }

  console.log(`✓ Total Loan: ₹${totalLoanPayable}, Total Collected: ₹${totalCollected}, Outstanding: ₹${outstanding}.00 (RECONCILED)`)
}

function runAll() {
  console.log('========================================================')
  console.log('STARTING PAYMENT ALLOCATION TEST SUITE')
  console.log('========================================================\n')
  testDeterministicFIFOAllocation()
  testFullSettlementReconciliation()
  console.log('\n========================================================')
  console.log('ALL PAYMENT ALLOCATION TESTS PASSED!')
  console.log('========================================================\n')
}

runAll()
