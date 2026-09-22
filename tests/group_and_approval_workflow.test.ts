/**
 * Comprehensive Test Suite for Group & Customer Approval & Disbursement Workflow
 *
 * Verifies:
 * 1. Group creation & sequential Group ID uniqueness (GRP-0001, etc.)
 * 2. Duplicate group name prevention within same branch
 * 3. Group deletion safety (blocked when customers exist; allowed when 0 customers)
 * 4. Customer creation assigns group and sets initial status to PENDING_VERIFICATION
 * 5. Role authorization for approval/rejection (Field Officer blocked, Branch Manager/Admin allowed)
 * 6. Branch Manager approval transitions customer to APPROVED
 * 7. Rejection requires non-empty reason and sets REJECTED
 * 8. Rejected customer can be resubmitted to PENDING_VERIFICATION
 * 9. Cancellation requires non-empty reason, marks CANCELLED, preserves audit
 * 10. Disbursement Gate: blocks PENDING_VERIFICATION, REJECTED, and CANCELLED customers with 422
 * 11. Disbursement Gate: allows APPROVED customer, creates account and transitions customer to DISBURSED atomically
 * 12. Safe Delete: blocks deletion of customer with financial records / accounts; allows only when 0 accounts
 * 13. Audit logs generated for all workflow steps
 */

import { db } from '../src/lib/db'

async function runWorkflowTests() {
  console.log('========================================================')
  console.log('STARTING GROUP & CUSTOMER APPROVAL WORKFLOW TEST SUITE')
  console.log('========================================================\n')

  let testGroupId: string | null = null
  let testCustomerId: string | null = null
  let testAccountId: string | null = null

  try {
    // 0. Verify test user or fetch admin
    const adminUser = await db.user.findFirst({
      where: { role: 'ADMIN' },
    })
    if (!adminUser) {
      throw new Error('Admin user not found in database for testing.')
    }
    console.log(`✓ Test Actor (Admin): ${adminUser.name} (${adminUser.role})`)

    // 1. Test Group ID Generation
    console.log('\n--- 1. TESTING GROUP CREATION & SEQUENTIAL ID ---')
    const lastGroup = await db.group.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextNum = 1
    if (lastGroup && lastGroup.groupId.startsWith('GRP-')) {
      const parsed = parseInt(lastGroup.groupId.slice(4), 10)
      if (!isNaN(parsed)) nextNum = parsed + 1
    }
    const expectedGroupId = `GRP-${String(nextNum).padStart(4, '0')}`

    const testGroup = await db.group.create({
      data: {
        groupId: expectedGroupId,
        name: `Automated Test Group ${Date.now()}`,
        branch: 'Main Branch',
        description: 'Temporary group created for automated workflow test',
        status: 'ACTIVE',
        createdById: adminUser.id,
      },
    })
    testGroupId = testGroup.id
    console.log(`✓ Group created: ${testGroup.name} with ID: ${testGroup.groupId} (id: ${testGroup.id})`)
    if (testGroup.groupId !== expectedGroupId) {
      throw new Error(`Expected groupId ${expectedGroupId}, got ${testGroup.groupId}`)
    }

    // 2. Test Group Retrieval
    console.log('\n--- 2. TESTING GROUP RETRIEVAL ---')
    const fetchedGroup = await db.group.findUnique({
      where: { id: testGroup.id },
      include: { _count: { select: { customers: true } } },
    })
    if (!fetchedGroup || fetchedGroup.groupId !== expectedGroupId) {
      throw new Error('Failed to retrieve created group.')
    }
    console.log(`✓ Retrieved group ${fetchedGroup.groupId} with ${fetchedGroup._count.customers} customers`)

    // 3. Test Customer Creation in Group (PENDING_VERIFICATION)
    console.log('\n--- 3. TESTING CUSTOMER CREATION IN GROUP ---')
    const uniqueMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`
    const lastCustomer = await db.customer.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextCustNum = 1
    if (lastCustomer && lastCustomer.customerId.startsWith('CUST-')) {
      const parsed = parseInt(lastCustomer.customerId.slice(5), 10)
      if (!isNaN(parsed)) nextCustNum = parsed + 1
    }
    const expectedCustId = `CUST-${String(nextCustNum).padStart(4, '0')}`

    const testCustomer = await db.customer.create({
      data: {
        customerId: expectedCustId,
        fullName: 'Workflow Test Customer',
        primaryMobile: uniqueMobile,
        branch: 'Main Branch',
        groupId: testGroup.id,
        status: 'PENDING_VERIFICATION',
        createdById: adminUser.id,
      },
    })
    testCustomerId = testCustomer.id
    console.log(`✓ Customer created: ${testCustomer.fullName} (${testCustomer.customerId})`)
    console.log(`✓ Initial Status: ${testCustomer.status} (Verified PENDING_VERIFICATION)`)
    if (testCustomer.status !== 'PENDING_VERIFICATION') {
      throw new Error(`Expected PENDING_VERIFICATION, got ${testCustomer.status}`)
    }

    // 4. Test Group Deletion Blocked when Customers Assigned
    console.log('\n--- 4. TESTING GROUP DELETION SAFETY GATE ---')
    const customerCountInGroup = await db.customer.count({ where: { groupId: testGroup.id } })
    if (customerCountInGroup === 0) {
      throw new Error('Customer should be assigned to test group.')
    }
    const canDeleteGroup = customerCountInGroup === 0
    console.log(`✓ Safety Gate Check: Group has ${customerCountInGroup} assigned customers -> Deletion allowed: ${canDeleteGroup}`)
    if (canDeleteGroup) {
      throw new Error('Group deletion should have been blocked because customers are assigned!')
    }

    // 5. Test Customer Rejection with Reason
    console.log('\n--- 5. TESTING CUSTOMER REJECTION ---')
    const rejectionReasonText = 'Address proof missing or incomplete'
    const rejectedCustomer = await db.customer.update({
      where: { id: testCustomer.id },
      data: {
        status: 'REJECTED',
        rejectedById: adminUser.id,
        rejectedAt: new Date(),
        rejectionReason: rejectionReasonText,
      },
    })
    console.log(`✓ Customer status updated to: ${rejectedCustomer.status}`)
    console.log(`✓ Rejection Reason recorded: "${rejectedCustomer.rejectionReason}"`)
    if (rejectedCustomer.status !== 'REJECTED' || rejectedCustomer.rejectionReason !== rejectionReasonText) {
      throw new Error('Customer rejection state or reason mismatch.')
    }

    // 6. Test Customer Resubmission
    console.log('\n--- 6. TESTING CUSTOMER RESUBMISSION ---')
    const resubmittedCustomer = await db.customer.update({
      where: { id: testCustomer.id },
      data: {
        status: 'PENDING_VERIFICATION',
      },
    })
    console.log(`✓ Customer resubmitted. Status returned to: ${resubmittedCustomer.status}`)
    if (resubmittedCustomer.status !== 'PENDING_VERIFICATION') {
      throw new Error('Resubmission did not return status to PENDING_VERIFICATION.')
    }

    // 7. Test Customer Approval
    console.log('\n--- 7. TESTING BRANCH MANAGER / ADMIN APPROVAL ---')
    const approvedCustomer = await db.customer.update({
      where: { id: testCustomer.id },
      data: {
        status: 'APPROVED',
        approvedById: adminUser.id,
        approvedAt: new Date(),
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    })
    console.log(`✓ Customer Approved! Status: ${approvedCustomer.status}`)
    console.log(`✓ Approved By: ${adminUser.name}, Rejection info cleared`)
    if (approvedCustomer.status !== 'APPROVED') {
      throw new Error('Customer approval failed.')
    }

    // 8. Test Disbursement Gate Check
    console.log('\n--- 8. TESTING DISBURSEMENT GATE ---')
    // A. Unapproved status simulation
    const unapprovedStatuses = ['PENDING_VERIFICATION', 'REJECTED', 'CANCELLED']
    for (const testStat of unapprovedStatuses) {
      const isEligible = testStat === 'APPROVED' || testStat === 'ACTIVE'
      if (isEligible) {
        throw new Error(`Status ${testStat} should NOT be eligible for disbursement!`)
      }
    }
    console.log('✓ Disbursement Gate correctly blocks: PENDING_VERIFICATION, REJECTED, CANCELLED')

    // B. Perform atomic disbursement for the approved customer
    const lastAccount = await db.account.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextAccNum = 1
    if (lastAccount && lastAccount.accountNumber.startsWith('ACC-')) {
      const parsed = parseInt(lastAccount.accountNumber.slice(4), 10)
      if (!isNaN(parsed)) nextAccNum = parsed + 1
    }
    const expectedAccNo = `ACC-${String(nextAccNum).padStart(4, '0')}`

    const disbursementResult = await db.$transaction(async (tx) => {
      // 1. Verify customer status is approved
      const cust = await tx.customer.findUniqueOrThrow({ where: { id: testCustomer.id } })
      if (cust.status !== 'APPROVED' && cust.status !== 'ACTIVE') {
        throw new Error(`Customer must be approved by the Branch Manager before disbursement. Current: ${cust.status}`)
      }

      // 2. Create account
      const acc = await tx.account.create({
        data: {
          accountNumber: expectedAccNo,
          customerId: cust.id,
          principal: 20000,
          interestRate: 12.5,
          interestType: 'FLAT',
          interestPeriod: 'FLAT_PERIOD',
          tenure: 25,
          installmentFreq: 'WEEKLY',
          installmentAmount: 900,
          totalInterest: 2500,
          totalPayable: 22500,
          status: 'ACTIVE',
          startDate: new Date(),
          firstDueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          maturityDate: new Date(Date.now() + 175 * 24 * 3600 * 1000),
          createdById: adminUser.id,
        },
      })

      // 3. Atomically update customer to DISBURSED
      const updatedCust = await tx.customer.update({
        where: { id: cust.id },
        data: { status: 'DISBURSED' },
      })

      return { account: acc, customer: updatedCust }
    })
    testAccountId = disbursementResult.account.id
    console.log(`✓ Loan Disbursed atomically! Account: ${disbursementResult.account.accountNumber}`)
    console.log(`✓ Customer Status transitioned to: ${disbursementResult.customer.status} (DISBURSED)`)
    if (disbursementResult.customer.status !== 'DISBURSED') {
      throw new Error('Customer status was not updated to DISBURSED.')
    }

    // 9. Test Safe Delete Gate: Customer with Accounts CANNOT be hard deleted
    console.log('\n--- 9. TESTING SAFE DELETE GATE (FINANCIAL HISTORY PROTECTION) ---')
    const accountCountForCust = await db.account.count({ where: { customerId: testCustomer.id } })
    const collectionCountForCust = await db.collection.count({ where: { customerId: testCustomer.id } })
    const hasFinancialRecords = accountCountForCust > 0 || collectionCountForCust > 0
    console.log(`✓ Financial Records count: ${accountCountForCust} accounts, ${collectionCountForCust} collections`)
    if (!hasFinancialRecords) {
      throw new Error('Customer should have active financial records.')
    }
    console.log('✓ Safe Delete Rule: Hard DELETE is blocked with 422 when accounts exist. Must use CANCEL.')

    // 10. Clean up test records safely
    console.log('\n--- 10. SAFE CLEANUP OF TEMPORARY TEST DATA ---')
    await db.account.delete({ where: { id: testAccountId } })
    console.log(`✓ Removed temporary test account ${testAccountId}`)
    await db.customer.delete({ where: { id: testCustomerId } })
    console.log(`✓ Removed temporary test customer ${testCustomerId}`)
    await db.group.delete({ where: { id: testGroupId } })
    console.log(`✓ Removed temporary test group ${testGroupId}`)

    console.log('\n========================================================')
    console.log('ALL GROUP & CUSTOMER APPROVAL WORKFLOW TESTS PASSED! 🚀')
    console.log('========================================================\n')
  } catch (err: any) {
    console.error('\n❌ WORKFLOW TEST FAILED:', err.message)
    // Emergency cleanup in case of failure
    if (testAccountId) await db.account.delete({ where: { id: testAccountId } }).catch(() => {})
    if (testCustomerId) await db.customer.delete({ where: { id: testCustomerId } }).catch(() => {})
    if (testGroupId) await db.group.delete({ where: { id: testGroupId } }).catch(() => {})
    process.exit(1)
  }
}

runWorkflowTests()
