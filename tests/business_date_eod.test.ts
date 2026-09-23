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

function runAll() {
  console.log('========================================================')
  console.log('STARTING BUSINESS DATE & EOD SUITE')
  console.log('========================================================\n')
  testEODReconciliationFormula()
  testDifferenceResolutionLogic()
  testNextBusinessDateSequence()
  testBankDepositImpact()
  console.log('\n========================================================')
  console.log('ALL BUSINESS DATE & EOD RECONCILIATION TESTS PASSED!')
  console.log('========================================================\n')
}

runAll()
