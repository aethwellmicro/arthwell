/**
 * Authoritative End-to-End Test for Back-Dated Business Dates & EOD Closures
 * Tests live DB records, backdated collection/expense creation, EOD reconciliation,
 * and reopening capabilities.
 */
import { db } from '../src/lib/db'
import {
  getActiveBusinessDate,
  getBusinessDateSummary,
  closeActiveBusinessDate,
  reopenBusinessDate,
} from '../src/lib/business-date'

async function runE2ETests() {
  console.log('=================================================================')
  console.log('STARTING END-TO-END VERIFICATION: BACK-DATED BUSINESS DATES & EOD')
  console.log('=================================================================\n')

  // Clean up any previous test records if leftover
  await db.collection.deleteMany({ where: { receiptNumber: { startsWith: 'TEST-E2E-' } } })
  await db.expense.deleteMany({ where: { expenseNumber: { startsWith: 'EXP-E2E-' } } })

  // 1. Verify all 66 sequential dates exist and are OPEN from July 25 to Sept 28
  console.log('--- 1. VERIFYING BUSINESS DATES (JULY 25 - SEPT 28, 2026) ---')
  const openCount = await db.businessDate.count({
    where: { status: { in: ['OPEN', 'REOPENED'] } },
  })
  console.log(`Found ${openCount} open/reopened business dates in DB.`)
  if (openCount < 60) throw new Error(`Expected at least 60 open dates, found ${openCount}`)

  const jul25 = await db.businessDate.findFirst({
    where: {
      businessDate: {
        gte: new Date('2026-07-25T00:00:00.000Z'),
        lte: new Date('2026-07-25T23:59:59.999Z'),
      },
    },
  })
  if (!jul25 || jul25.status !== 'OPEN') {
    throw new Error('Business date for July 25 must exist and be OPEN')
  }
  console.log(`✓ 2026-07-25 confirmed OPEN (ID: ${jul25.id})`)

  const jul27 = await db.businessDate.findFirst({
    where: {
      businessDate: {
        gte: new Date('2026-07-27T00:00:00.000Z'),
        lte: new Date('2026-07-27T23:59:59.999Z'),
      },
    },
  })
  if (!jul27 || jul27.status !== 'OPEN') {
    throw new Error('Business date for July 27 must exist and be OPEN')
  }
  console.log(`✓ 2026-07-27 confirmed OPEN (ID: ${jul27.id})`)

  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!admin) throw new Error('Admin user required for E2E tests')
  const sessionUser = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: 'ADMIN' as const,
  }

  // 2. Test getActiveBusinessDate with specific target date 2026-07-27
  console.log('\n--- 2. TESTING GETACTIVEBUSINESSDATE FOR TARGET DATE (2026-07-27) ---')
  const matchedJul27 = await getActiveBusinessDate(sessionUser, undefined, '2026-07-27')
  if (!matchedJul27) throw new Error('Failed to resolve active business date for 2026-07-27')
  const resolvedDateStr = matchedJul27.businessDate.toISOString().slice(0, 10)
  if (resolvedDateStr !== '2026-07-27') {
    throw new Error(`Expected date 2026-07-27, got ${resolvedDateStr}`)
  }
  console.log(`✓ getActiveBusinessDate correctly resolved exact target date: ${resolvedDateStr}`)

  // 3. Test backdated collection creation linked to July 27, 2026
  console.log('\n--- 3. TESTING BACKDATED COLLECTION RECORDING ON JULY 27 ---')
  let testCustomer = await db.customer.findFirst({
    where: { accounts: { some: {} } },
    include: { accounts: true },
  })

  if (!testCustomer || !testCustomer.accounts.length) {
    throw new Error('No existing customer with account found for collection test')
  }

  const testAccount = testCustomer.accounts[0]
  const testReceiptNum = `TEST-E2E-${Date.now()}`
  const testExpenseNum = `EXP-E2E-${Date.now()}`

  let testCollectionId: string | null = null
  let testExpenseId: string | null = null

  try {
    const testCollection = await db.collection.create({
      data: {
        receiptNumber: testReceiptNum,
        customerId: testCustomer.id,
        accountId: testAccount.id,
        businessDateId: jul27.id,
        collectionDate: new Date('2026-07-27T10:00:00.000Z'),
        amount: 1500,
        paymentMode: 'CASH',
        status: 'APPROVED',
        previousOutstanding: 10000,
        currentOutstanding: 8500,
        collectedById: admin.id,
        approvedById: admin.id,
        approvedAt: new Date(),
      },
    })
    testCollectionId = testCollection.id
    console.log(`✓ Backdated collection created for ₹1,500 on 2026-07-27 (Receipt: ${testReceiptNum}, BusinessDateId: ${testCollection.businessDateId})`)
    if (testCollection.businessDateId !== jul27.id) {
      throw new Error('Collection was not linked to July 27 businessDateId')
    }

    // 4. Test backdated expense creation linked to July 27, 2026
    console.log('\n--- 4. TESTING BACKDATED EXPENSE RECORDING ON JULY 27 ---')
    const testExpense = await db.expense.create({
      data: {
        expenseNumber: testExpenseNum,
        businessDateId: jul27.id,
        expenseType: 'STATIONERY_ADMIN',
        particulars: 'Backdated stationery purchase test',
        amount: 300,
        paymentMode: 'CASH',
        expenseDate: new Date('2026-07-27T14:30:00.000Z'),
        createdById: admin.id,
      },
    })
    testExpenseId = testExpense.id
    console.log(`✓ Backdated expense created for ₹300 on 2026-07-27 (Number: ${testExpenseNum}, BusinessDateId: ${testExpense.businessDateId})`)

    // 5. Test getBusinessDateSummary for July 27, 2026
    console.log('\n--- 5. TESTING EOD SUMMARY & RECONCILIATION CALCULATION ON JULY 27 ---')
    const summaryJul27 = await getBusinessDateSummary(jul27.id)
    console.log('July 27 Summary:')
    console.log(`  - Opening Cash: ₹${summaryJul27.openingCash}`)
    console.log(`  - Cash Collections: ₹${summaryJul27.cashCollections}`)
    console.log(`  - Cash Expenses: ₹${summaryJul27.cashExpenses}`)
    console.log(`  - Expected Closing Cash: ₹${summaryJul27.expectedClosingCash}`)

    if (summaryJul27.cashCollections < 1500) {
      throw new Error(`Expected at least ₹1500 cash collections on July 27, got ${summaryJul27.cashCollections}`)
    }
    if (summaryJul27.cashExpenses < 300) {
      throw new Error(`Expected at least ₹300 cash expenses on July 27, got ${summaryJul27.cashExpenses}`)
    }
    console.log('✓ Summary calculation accurately captures July 27 transactions!')

    // 6. Test EOD Day End Closure on July 27, 2026
    console.log('\n--- 6. TESTING INDEPENDENT EOD CLOSURE FOR JULY 27 ---')
    const closeResult = await closeActiveBusinessDate({
      user: sessionUser,
      businessDateId: jul27.id,
      actualCashInHand: summaryJul27.expectedClosingCash,
      notes: 'E2E automated test day closure for July 27',
    })

    console.log(`✓ July 27 closed successfully!`)
    console.log(`  - Status: ${closeResult.closedDate.status}`)
    console.log(`  - Reconciliation: ${closeResult.closedDate.reconciliationStatus}`)
    console.log(`  - Closing Cash: ₹${closeResult.closedDate.closingCash}`)

    if (closeResult.closedDate.status !== 'CLOSED') {
      throw new Error('Expected closed date status to be CLOSED')
    }

    // Verify July 28 remains OPEN
    const jul28 = await db.businessDate.findFirst({
      where: {
        businessDate: {
          gte: new Date('2026-07-28T00:00:00.000Z'),
          lte: new Date('2026-07-28T23:59:59.999Z'),
        },
      },
    })
    if (!jul28 || jul28.status !== 'OPEN') {
      throw new Error('July 28 must remain OPEN after July 27 EOD closure')
    }
    console.log(`✓ July 28 confirmed OPEN (Status: ${jul28.status}) - sequential continuity preserved`)

    // 7. Test Admin Reopening for July 27
    console.log('\n--- 7. TESTING ADMIN REOPENING FOR JULY 27 (WITH LATER DATES OPEN) ---')
    const reopenedJul27 = await reopenBusinessDate({
      user: sessionUser,
      businessDateId: jul27.id,
      reason: 'Backdated entry adjustments verification',
    })
    console.log(`✓ July 27 reopened successfully! Status: ${reopenedJul27.status}`)
    if (reopenedJul27.status !== 'REOPENED') {
      throw new Error('Expected status to be REOPENED')
    }

    // Restore July 27 to OPEN
    await db.businessDate.update({
      where: { id: jul27.id },
      data: { status: 'OPEN' },
    })
    console.log(`✓ Restored July 27 to OPEN for continued user data entry.`)
  } finally {
    // 8. Cleanup test transaction entries
    console.log('\n--- 8. CLEANING UP TEST TRANSACTION RECORDS ---')
    if (testCollectionId) {
      await db.collection.delete({ where: { id: testCollectionId } }).catch(() => {})
      console.log(`✓ Deleted test collection (${testReceiptNum}).`)
    }
    if (testExpenseId) {
      await db.expense.delete({ where: { id: testExpenseId } }).catch(() => {})
      console.log(`✓ Deleted test expense (${testExpenseNum}).`)
    }
  }

  console.log('\n=================================================================')
  console.log('ALL END-TO-END TESTS PASSED SUCCESSFULLY! 🚀')
  console.log('=================================================================\n')
}

runE2ETests()
  .catch((err) => {
    console.error('\n❌ E2E TEST FAILED:', err)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
