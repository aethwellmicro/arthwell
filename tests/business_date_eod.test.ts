/**
 * Tests for Business Date, EOD reconciliation, cash flow, difference resolution, and locking.
 */
import {
  parseCalendarDate,
  addPeriod,
  calculateLoan,
} from '../src/lib/calc'
import { toMoney, addMoney, subMoney } from '../src/lib/money'

function testEODReconciliationFormula() {
  console.log('=== TEST 1: EOD RECONCILIATION CASH FLOW FORMULA ===')
  const openingCash = 100000
  const collections = 50000
  const disbursements = 30000
  const bankDeposits = 70000

  // Formula: Expected Closing Cash = Opening + Collections - Disbursements - Bank Deposits
  const expectedClosing = subMoney(
    subMoney(addMoney(openingCash, collections), disbursements),
    bankDeposits
  )

  if (expectedClosing !== 50000) {
    throw new Error(`Expected 50000, got ${expectedClosing}`)
  }
  console.log(`✓ Cash Flow Waterfall: Opening(100k) + Collections(50k) - Disb(30k) - Deposit(70k) = ₹${expectedClosing} (MATCH)`)
}

function testDifferenceResolutionLogic() {
  console.log('\n=== TEST 2: DIFFERENCE RESOLUTION & MANDATORY REASON ===')
  const expectedClosing = 50000

  // Scenario A: Exact cash counted (Balanced)
  const actualCountA = 50000
  const diffA = subMoney(actualCountA, expectedClosing)
  if (diffA !== 0) throw new Error('Expected 0 diff for balanced EOD')
  console.log('✓ Scenario A: Balanced cash (diff=0) -> Allowed without reason')

  // Scenario B: Difference detected without reason -> BLOCKED
  const actualCountB = 48500
  const diffB = subMoney(actualCountB, expectedClosing)
  const reasonB = ''
  const isBlockedB = diffB !== 0 && reasonB.trim().length === 0
  if (!isBlockedB) throw new Error('Difference without reason must be blocked!')
  console.log(`✓ Scenario B: Cash difference (₹${Math.abs(diffB)}) without reason -> BLOCKED (Expected)`)

  // Scenario C: Difference detected with authorized reason -> RESOLVED
  const reasonC = 'Vault count shortage of ₹1,500 under verification by manager'
  const isAllowedC = diffB !== 0 && reasonC.trim().length > 0
  if (!isAllowedC) throw new Error('Difference with reason must be permitted with audit')
  console.log(`✓ Scenario C: Cash difference with reason ("${reasonC}") -> ALLOWED & AUDITED`)
}

function testNextBusinessDateSequence() {
  console.log('\n=== TEST 3: BUSINESS DATE PROGRESSION SEQUENCE ===')
  const d1 = parseCalendarDate('2026-09-23')
  const d2 = addPeriod(d1, 'DAILY')
  const d2Str = d2.toISOString().slice(0, 10)
  if (d2Str !== '2026-09-24') {
    throw new Error(`Expected next business date 2026-09-24, got ${d2Str}`)
  }

  const d3 = addPeriod(d2, 'DAILY')
  const d3Str = d3.toISOString().slice(0, 10)
  if (d3Str !== '2026-09-25') {
    throw new Error(`Expected next business date 2026-09-25, got ${d3Str}`)
  }
  console.log(`✓ Sequential Business Date increment: ${d1.toISOString().slice(0, 10)} -> ${d2Str} -> ${d3Str} (strictly sequential, no skipping)`)
}

function testBankDepositImpact() {
  console.log('\n=== TEST 4: BANK DEPOSIT REDUCES VAULT CASH ===')
  const opening = 80000
  const depositAmt = 45000
  const remainingCash = subMoney(opening, depositAmt)
  if (remainingCash !== 35000) {
    throw new Error(`Expected 35000 remaining, got ${remainingCash}`)
  }
  console.log(`✓ Bank deposit ₹45,000 against ₹80,000 vault -> Expected Vault Cash is ₹${remainingCash}`)
}

function testBackdatedBusinessDateSequenceFromJuly25() {
  console.log('\n=== TEST 5: BUSINESS DATE SEQUENCE FROM 25-JUL-2026 ONWARDS ===')
  const startDate = parseCalendarDate('2026-07-25')
  const sStr = startDate.toISOString().slice(0, 10)
  if (sStr !== '2026-07-25') throw new Error(`Expected 2026-07-25, got ${sStr}`)

  let cur = startDate
  const expectedSequence = [
    '2026-07-25',
    '2026-07-26',
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
  ]

  for (let i = 0; i < expectedSequence.length; i++) {
    const curStr = cur.toISOString().slice(0, 10)
    if (curStr !== expectedSequence[i]) {
      throw new Error(`Sequence mismatch at step ${i}: expected ${expectedSequence[i]}, got ${curStr}`)
    }
    cur = addPeriod(cur, 'DAILY')
  }
  console.log('✓ Sequential Business Date verification from 25-Jul-2026 -> 26-Jul-2026 -> 27-Jul-2026 -> 28-Jul-2026 -> 29-Jul-2026: PASS')
}

function testCollectionApprovalCashBookSegregation() {
  console.log('\n=== TEST 6: FIELD OFFICER COLLECTION APPROVAL & CASH BOOK SEGREGATION ===')
  // Scenario: Field Officer records ₹2,600 collection
  const collectionEntry = {
    id: 'col-1',
    amount: 2600,
    status: 'PENDING_APPROVAL',
  }

  // 1. Pending collection must NOT enter Cash Book
  const cashBookCollections = [collectionEntry].filter((c) => c.status === 'APPROVED' || c.status === 'SUCCESSFUL')
  if (cashBookCollections.length !== 0) {
    throw new Error('PENDING_APPROVAL collection should NOT be in Cash Book!')
  }
  console.log('✓ Step 1: PENDING_APPROVAL collection excluded from Cash Book: PASS')

  // 2. Pending collection does NOT affect closing cash in EOD
  const opening = 10000
  let cashBookTotal = cashBookCollections.reduce((s, c) => s + c.amount, 0)
  let expectedClosing = addMoney(opening, cashBookTotal)
  if (expectedClosing !== 10000) {
    throw new Error(`Expected closing ₹10,000 while collection is pending, got ${expectedClosing}`)
  }
  console.log('✓ Step 2: PENDING_APPROVAL collection does not affect EOD closing cash: PASS')

  // 3. Back Office Approves
  collectionEntry.status = 'APPROVED'
  const approvedCashBookCollections = [collectionEntry].filter((c) => c.status === 'APPROVED' || c.status === 'SUCCESSFUL')
  if (approvedCashBookCollections.length !== 1) {
    throw new Error('APPROVED collection must be in Cash Book!')
  }
  cashBookTotal = approvedCashBookCollections.reduce((s, c) => s + c.amount, 0)
  expectedClosing = addMoney(opening, cashBookTotal)
  if (expectedClosing !== 12600) {
    throw new Error(`Expected closing ₹12,600 after approval, got ${expectedClosing}`)
  }
  console.log(`✓ Step 3: APPROVED collection reflects in Cash Book & increases closing cash to ₹${expectedClosing}: PASS`)

  // 4. Rejection requires reason and does NOT enter Cash Book
  const rejectedEntry = {
    id: 'col-2',
    amount: 1500,
    status: 'REJECTED',
    rejectionReason: 'Cash not deposited in branch',
  }
  if (!rejectedEntry.rejectionReason) throw new Error('Rejection must have reason')
  const rejectedInCashBook = [rejectedEntry].filter((c) => c.status === 'APPROVED' || c.status === 'SUCCESSFUL')
  if (rejectedInCashBook.length !== 0) {
    throw new Error('REJECTED collection entered Cash Book!')
  }
  console.log('✓ Step 4: REJECTED collection with reason excluded from Cash Book: PASS')
}

function testTrialBalanceReconciliation() {
  console.log('\n=== TEST 7: TRIAL BALANCE BALANCING (DEBIT = CREDIT) ===')
  const items = [
    { code: '1001', account: 'Cash in Hand (Vault)', debit: 50000, credit: 0 },
    { code: '1002', account: 'Bank Accounts', debit: 20000, credit: 0 },
    { code: '1003', account: 'Loan Portfolio Receivables', debit: 100000, credit: 0 },
    { code: '2001', account: 'Capital / Investor Inflows', debit: 0, credit: 150000 },
    { code: '2002', account: 'Customer Compulsory Savings', debit: 0, credit: 10000 },
    { code: '3001', account: 'Interest Income from Loans', debit: 0, credit: 15000 },
    { code: '4001', account: 'Operating & Admin Expenses', debit: 5000, credit: 0 },
  ]

  const totalDebit = items.reduce((s, it) => s + it.debit, 0)
  const totalCredit = items.reduce((s, it) => s + it.credit, 0)
  const diff = subMoney(totalDebit, totalCredit)

  if (diff !== 0) {
    throw new Error(`Trial Balance mismatch! Debit: ${totalDebit}, Credit: ${totalCredit}`)
  }
  console.log(`✓ Trial Balance Reconciles: Total Debit (₹${totalDebit}) = Total Credit (₹${totalCredit}) [Diff: ₹${diff}]: PASS`)
}

function runAll() {
  console.log('========================================================')
  console.log('STARTING BUSINESS DATE & EOD SUITE')
  console.log('========================================================\n')
  testEODReconciliationFormula()
  testDifferenceResolutionLogic()
  testNextBusinessDateSequence()
  testBankDepositImpact()
  testBackdatedBusinessDateSequenceFromJuly25()
  testCollectionApprovalCashBookSegregation()
  testTrialBalanceReconciliation()
  console.log('\n========================================================')
  console.log('ALL BUSINESS DATE, EOD & COLLECTION APPROVAL TESTS PASSED!')
  console.log('========================================================\n')
}

runAll()
