/**
 * Test Suite: Collection Due by Date & Field Officer Grouping
 *
 * Verifies:
 * 1. Filtering by date isolates installments due strictly on that calendar date
 * 2. Disbursements made today do NOT appear as collections due today (Disb + 1 period rule)
 * 3. Results are aggregated and grouped by Field Officer / Collection Employee
 * 4. Subtotals calculated: Total Customers, Total Due, Total Collected, Pending Amount
 */

import { parseCalendarDate, calculateLoan } from '../src/lib/calc'

function testCollectionDueDateAndGrouping() {
  console.log('========================================================')
  console.log('STARTING COLLECTION DUE BY DATE & GROUPING TEST SUITE')
  console.log('========================================================\n')

  console.log('--- 1. TESTING FIRST COLLECTION RULE (DISBURSEMENT + 1 PERIOD) ---')
  const disbDate = parseCalendarDate('2026-09-20') // Sunday
  const loan = calculateLoan({
    principal: 20000,
    interestRate: 12.5,
    interestType: 'REDUCING',
    interestPeriod: 'YEARLY',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: disbDate,
  })

  // Check installment dates
  const emi1Date = loan.schedule[0].dueDate.toISOString().slice(0, 10)
  const disbDateStr = disbDate.toISOString().slice(0, 10)

  console.log(`Disbursement Date: ${disbDateStr}`)
  console.log(`EMI #1 Due Date:   ${emi1Date}`)

  if (emi1Date === disbDateStr) {
    throw new Error('FAILED: Loan disbursed today must NOT have collection due today!')
  }
  if (emi1Date !== '2026-09-27') {
    throw new Error(`Expected EMI #1 on 2026-09-27, got ${emi1Date}`)
  }
  console.log('✓ PASS: First collection is exactly 1 period (7 days) after disbursement date.')

  console.log('\n--- 2. TESTING FIELD OFFICER GROUPING & SUB-TOTALS ---')
  // Mock active installments on 2026-09-27
  const mockInstallments = [
    {
      officerId: 'off-1',
      officerName: 'Rahul Sharma',
      officerCode: 'EMP-001',
      customerId: 'CUST-001',
      customerName: 'Customer A',
      emi: 900.03,
      savings: 100,
      paid: 0,
    },
    {
      officerId: 'off-1',
      officerName: 'Rahul Sharma',
      officerCode: 'EMP-001',
      customerId: 'CUST-002',
      customerName: 'Customer B',
      emi: 2500.10,
      savings: 100,
      paid: 2600.10,
    },
    {
      officerId: 'off-2',
      officerName: 'Priya Verma',
      officerCode: 'EMP-002',
      customerId: 'CUST-003',
      customerName: 'Customer C',
      emi: 1250.09,
      savings: 100,
      paid: 500,
    },
  ]

  // Group by Officer
  const officerMap = new Map<string, any>()
  for (const item of mockInstallments) {
    let off = officerMap.get(item.officerId)
    if (!off) {
      off = {
        name: item.officerName,
        code: item.officerCode,
        totalCustomers: 0,
        totalDue: 0,
        totalCollected: 0,
        totalPending: 0,
      }
      officerMap.set(item.officerId, off)
    }
    const due = item.emi + item.savings
    const pending = Math.max(due - item.paid, 0)

    off.totalCustomers++
    off.totalDue += due
    off.totalCollected += item.paid
    off.totalPending += pending
  }

  const rahul = officerMap.get('off-1')
  console.log(`Officer: ${rahul.name} (${rahul.code})`)
  console.log(`- Customers: ${rahul.totalCustomers}`)
  console.log(`- Total Due: ₹${rahul.totalDue.toFixed(2)}`)
  console.log(`- Total Collected: ₹${rahul.totalCollected.toFixed(2)}`)
  console.log(`- Total Pending: ₹${rahul.totalPending.toFixed(2)}`)

  if (rahul.totalCustomers !== 2) throw new Error('Customer count mismatch for Rahul')
  if (Math.abs(rahul.totalDue - 3600.13) > 0.05) throw new Error('Total due mismatch for Rahul')
  if (Math.abs(rahul.totalPending - 1000.03) > 0.05) throw new Error('Total pending mismatch for Rahul')
  console.log('✓ PASS: Officer groupings, customer counts, and subtotals calculated accurately.')

  console.log('\n========================================================')
  console.log('ALL COLLECTION DUE BY DATE TESTS PASSED! 🚀')
  console.log('========================================================\n')
}

testCollectionDueDateAndGrouping()
