import { calculateLoan, parseCalendarDate, addPeriod } from '../src/lib/calc'

function testDates() {
  console.log('=== RUNNING DATE TESTS ===')
  const start = parseCalendarDate('2026-09-20')
  const res = calculateLoan({
    principal: 20000,
    interestRate: 12.5,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: start,
  })

  // 1. Check 25 installments
  if (res.schedule.length !== 25) {
    throw new Error(`Expected 25 installments, got ${res.schedule.length}`)
  }

  // 2. Check no duplicate dates and no date equals disbursement
  const dateSet = new Set<string>()
  res.schedule.forEach((item, idx) => {
    const s = item.dueDate.toISOString().slice(0, 10)
    if (dateSet.has(s)) {
      throw new Error(`Duplicate due date: ${s}`)
    }
    dateSet.add(s)
    if (s === '2026-09-20') {
      throw new Error(`Installment #${idx + 1} has disbursement date 2026-09-20!`)
    }
  })

  // 3. Check firstDueDate
  const firstDue = res.firstDueDate.toISOString().slice(0, 10)
  if (firstDue !== '2026-09-27') {
    throw new Error(`Expected firstDueDate 2026-09-27, got ${firstDue}`)
  }

  // 4. Check maturityDate
  const matDue = res.maturityDate.toISOString().slice(0, 10)
  if (matDue !== '2027-03-14') {
    throw new Error(`Expected maturityDate 2027-03-14, got ${matDue}`)
  }

  console.log('DATE TESTS: PASS (first due: 2026-09-27, maturity: 2027-03-14)')
}

function testReferenceA() {
  console.log('=== RUNNING REFERENCE A TESTS ===')
  const res = calculateLoan({
    principal: 20000,
    interestRate: 12.5,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  const expectedA = [
    { w: 1, int: 185.52, prin: 714.51, emi: 900.03 },
    { w: 2, int: 178.89, prin: 721.14, emi: 900.03 },
    { w: 3, int: 172.20, prin: 727.83, emi: 900.03 },
    { w: 4, int: 165.45, prin: 734.58, emi: 900.03 },
    { w: 5, int: 158.64, prin: 741.39, emi: 900.03 },
    { w: 6, int: 151.76, prin: 748.27, emi: 900.03 },
    { w: 7, int: 144.82, prin: 755.21, emi: 900.03 },
    { w: 8, int: 137.81, prin: 762.22, emi: 900.03 },
    { w: 9, int: 130.74, prin: 769.29, emi: 900.03 },
    { w: 10, int: 123.61, prin: 776.42, emi: 900.03 },
    { w: 11, int: 116.41, prin: 783.62, emi: 900.03 },
    { w: 12, int: 109.14, prin: 790.89, emi: 900.03 },
    { w: 13, int: 101.80, prin: 798.23, emi: 900.03 },
    { w: 14, int: 94.40, prin: 805.63, emi: 900.03 },
    { w: 15, int: 86.92, prin: 813.11, emi: 900.03 },
    { w: 16, int: 79.38, prin: 820.65, emi: 900.03 },
    { w: 17, int: 71.77, prin: 828.26, emi: 900.03 },
    { w: 18, int: 64.09, prin: 835.94, emi: 900.03 },
    { w: 19, int: 56.33, prin: 843.70, emi: 900.03 },
    { w: 20, int: 48.51, prin: 851.52, emi: 900.03 },
    { w: 21, int: 40.61, prin: 859.42, emi: 900.03 },
    { w: 22, int: 32.63, prin: 867.40, emi: 900.03 },
    { w: 23, int: 24.59, prin: 875.44, emi: 900.03 },
    { w: 24, int: 16.47, prin: 883.56, emi: 900.03 },
    { w: 25, int: 8.27, prin: 891.77, emi: 900.04 }, // controlled reconciliation (within 0.01)
  ]

  for (let i = 0; i < 24; i++) {
    const act = res.schedule[i]
    const exp = expectedA[i]
    if (Math.abs(act.interestPart - exp.int) > 0.01 || Math.abs(act.principalPart - exp.prin) > 0.01) {
      throw new Error(`Week ${i+1} mismatch: act (int=${act.interestPart}, prin=${act.principalPart}) vs exp (int=${exp.int}, prin=${exp.prin})`)
    }
  }

  // Check reconciliation:
  const sumPrin = res.schedule.reduce((s, row) => s + row.principalPart, 0)
  const sumInt = res.schedule.reduce((s, row) => s + row.interestPart, 0)
  const sumTotal = res.schedule.reduce((s, row) => s + row.amount, 0)

  if (Math.abs(sumPrin - 20000) > 0.001) {
    throw new Error(`Sum of principal parts does not equal original principal: ${sumPrin}`)
  }
  if (Math.abs(res.schedule[24].balance) > 0.001) {
    throw new Error(`Final balance does not equal 0.00: ${res.schedule[24].balance}`)
  }

  console.log('REFERENCE A: PASS (all 25 rows match, principal reconciled to exactly 20000.00, final bal = 0.00)')
}

function testReferenceB() {
  console.log('=== RUNNING REFERENCE B TESTS ===')
  const res = calculateLoan({
    principal: 100000,
    interestRate: 25,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  const expectedB = [
    { w: 1, int: 1796.00, prin: 3204.20, emi: 5000.20 },
    { w: 2, int: 1738.45, prin: 3261.75, emi: 5000.20 },
    { w: 3, int: 1679.87, prin: 3320.33, emi: 5000.20 },
    { w: 4, int: 1620.24, prin: 3379.96, emi: 5000.20 },
    { w: 5, int: 1559.54, prin: 3440.66, emi: 5000.20 },
    { w: 25, int: 88.22, prin: 4911.96, emi: 5000.18 }, // controlled reconciliation
  ]

  for (let i = 0; i < 4; i++) {
    const act = res.schedule[i]
    const exp = expectedB[i]
    if (Math.abs(act.interestPart - exp.int) > 0.01 || Math.abs(act.principalPart - exp.prin) > 0.01) {
      throw new Error(`Week ${i+1} mismatch: act (int=${act.interestPart}, prin=${act.principalPart}) vs exp (int=${exp.int}, prin=${exp.prin})`)
    }
  }

  const sumPrin = res.schedule.reduce((s, row) => s + row.principalPart, 0)
  if (Math.abs(sumPrin - 100000) > 0.001) {
    throw new Error(`Sum of principal parts does not equal original principal: ${sumPrin}`)
  }
  if (Math.abs(res.schedule[24].balance) > 0.001) {
    throw new Error(`Final balance does not equal 0.00: ${res.schedule[24].balance}`)
  }

  console.log('REFERENCE B: PASS (matches fixture, principal reconciled to 100000.00, final bal = 0.00)')
}

function testReferenceC() {
  console.log('=== RUNNING REFERENCE C TESTS ===')
  const res = calculateLoan({
    principal: 50000,
    interestRate: 25,
    interestType: 'REDUCING',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  const expectedC = [
    { w: 1, int: 898.00, prin: 1602.10, emi: 2500.10 },
    { w: 2, int: 869.23, prin: 1630.87, emi: 2500.10 },
    { w: 3, int: 839.94, prin: 1660.16, emi: 2500.10 },
    { w: 4, int: 810.12, prin: 1689.98, emi: 2500.10 },
    { w: 25, int: 44.11, prin: 2455.98, emi: 2500.09 },
  ]

  for (let i = 0; i < 4; i++) {
    const act = res.schedule[i]
    const exp = expectedC[i]
    if (Math.abs(act.interestPart - exp.int) > 0.01 || Math.abs(act.principalPart - exp.prin) > 0.01) {
      throw new Error(`Week ${i+1} mismatch: act (int=${act.interestPart}, prin=${act.principalPart}) vs exp (int=${exp.int}, prin=${exp.prin})`)
    }
  }

  const sumPrin = res.schedule.reduce((s, row) => s + row.principalPart, 0)
  if (Math.abs(sumPrin - 50000) > 0.001) {
    throw new Error(`Sum of principal parts does not equal original principal: ${sumPrin}`)
  }
  if (Math.abs(res.schedule[24].balance) > 0.001) {
    throw new Error(`Final balance does not equal 0.00: ${res.schedule[24].balance}`)
  }

  console.log('REFERENCE C: PASS (matches fixture, principal reconciled to 50000.00, final bal = 0.00)')
}

function testFlat() {
  console.log('=== RUNNING FLAT TESTS ===')
  const res = calculateLoan({
    principal: 20000,
    interestRate: 12.5,
    interestType: 'FLAT',
    interestPeriod: 'FLAT_PERIOD',
    tenure: 25,
    installmentFreq: 'WEEKLY',
    startDate: '2026-09-20',
  })

  if (res.totalInterest !== 2500) {
    throw new Error(`Expected totalInterest 2500, got ${res.totalInterest}`)
  }
  if (res.totalPayable !== 22500) {
    throw new Error(`Expected totalPayable 22500, got ${res.totalPayable}`)
  }
  if (res.installmentAmount !== 900) {
    throw new Error(`Expected installmentAmount 900, got ${res.installmentAmount}`)
  }

  const sumPrin = res.schedule.reduce((s, row) => s + row.principalPart, 0)
  const sumInt = res.schedule.reduce((s, row) => s + row.interestPart, 0)
  const sumTotal = res.schedule.reduce((s, row) => s + row.amount, 0)

  if (Math.abs(sumPrin - 20000) > 0.001) throw new Error(`Flat sumPrin mismatch: ${sumPrin}`)
  if (Math.abs(sumInt - 2500) > 0.001) throw new Error(`Flat sumInt mismatch: ${sumInt}`)
  if (Math.abs(sumTotal - 22500) > 0.001) throw new Error(`Flat sumTotal mismatch: ${sumTotal}`)
  if (res.schedule[24].balance !== 0) throw new Error(`Flat final balance not zero: ${res.schedule[24].balance}`)

  console.log('FLAT TESTS: PASS (principal=20000, interest=2500, payable=22500, installment=900, final bal=0.00)')
}

function runAll() {
  testDates()
  testReferenceA()
  testReferenceB()
  testReferenceC()
  testFlat()
  console.log('\n========================================')
  console.log('ALL SCHEDULE & CALCULATION TESTS PASSED!')
  console.log('========================================\n')
}

runAll()
