// Interest & Installment Calculation Engine
// Supports FLAT and REDUCING (reducing-balance) interest methods.
// The interest rate meaning is defined by interestPeriod:
//   - MONTHLY: rate applied per month on principal (flat) or outstanding (reducing)
//   - YEARLY:  rate applied per year, pro-rated across tenure
//   - FLAT_PERIOD: rate applied once for the whole period on principal (flat method only)

import { toMoney, addMoney, mulMoney, subMoney, type Money } from './money'

export type InterestType = 'FLAT' | 'REDUCING'
export type InterestPeriod = 'MONTHLY' | 'YEARLY' | 'FLAT_PERIOD'
export type InstallmentFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface LoanInput {
  principal: number
  interestRate: number // e.g. 5 means 5%
  interestType: InterestType
  interestPeriod: InterestPeriod
  tenure: number // number of installments
  installmentFreq: InstallmentFreq
  startDate: Date
}

export interface ComputedLoan {
  principal: Money
  totalInterest: Money
  totalPayable: Money
  installmentAmount: Money
  firstDueDate: Date
  maturityDate: Date
  schedule: {
    installNo: number
    dueDate: Date
    amount: Money
    principalPart: Money
    interestPart: Money
    balance: Money
  }[]
}

function addPeriod(date: Date, freq: InstallmentFreq): Date {
  const d = new Date(date)
  switch (freq) {
    case 'DAILY':
      d.setDate(d.getDate() + 1)
      break
    case 'WEEKLY':
      d.setDate(d.getDate() + 7)
      break
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1)
      break
  }
  return d
}

export function calculateLoan(input: LoanInput): ComputedLoan {
  const principal = toMoney(input.principal)
  const rate = input.interestRate
  let totalInterest: Money = 0
  const schedule: ComputedLoan['schedule'] = []

  if (input.interestType === 'FLAT') {
    // Flat interest: principal * rate% * periods (depends on interestPeriod)
    if (input.interestPeriod === 'FLAT_PERIOD') {
      totalInterest = mulMoney(principal, rate / 100)
    } else if (input.interestPeriod === 'MONTHLY') {
      totalInterest = mulMoney(principal, (rate / 100) * input.tenure)
    } else {
      // YEARLY: convert tenure to years based on frequency
      const yearsPerInstall =
        input.installmentFreq === 'MONTHLY' ? 1 / 12 : input.installmentFreq === 'WEEKLY' ? 7 / 365 : 1 / 365
      const totalYears = yearsPerInstall * input.tenure
      totalInterest = mulMoney(principal, (rate / 100) * totalYears)
    }
    const totalPayable = addMoney(principal, totalInterest)
    const installmentAmount = input.tenure > 0 ? toMoney(totalPayable / input.tenure) : 0
    let balance = totalPayable
    let due = new Date(input.startDate)
    for (let i = 1; i <= input.tenure; i++) {
      balance = subMoney(balance, installmentAmount)
      schedule.push({
        installNo: i,
        dueDate: due,
        amount: installmentAmount,
        principalPart: principal,
        interestPart: totalInterest,
        balance: Math.max(balance, 0),
      })
      due = addPeriod(due, input.installmentFreq)
    }
    const firstDueDate = schedule[0]?.dueDate ?? input.startDate
    const maturityDate = schedule[schedule.length - 1]?.dueDate ?? input.startDate
    return {
      principal,
      totalInterest,
      totalPayable,
      installmentAmount,
      firstDueDate,
      maturityDate,
      schedule,
    }
  }

  // REDUCING balance (amortized). Use rate per period.
  // Convert rate to per-installment rate.
  let ratePerPeriod: number
  if (input.interestPeriod === 'MONTHLY') {
    ratePerPeriod = rate / 100
  } else if (input.interestPeriod === 'YEARLY') {
    const periodsPerYear =
      input.installmentFreq === 'MONTHLY' ? 12 : input.installmentFreq === 'WEEKLY' ? 52 : 365
    ratePerPeriod = rate / 100 / periodsPerYear
  } else {
    // FLAT_PERIOD with reducing -> treat as single period
    ratePerPeriod = rate / 100 / input.tenure
  }

  // Amortization formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
  const r = ratePerPeriod
  const n = input.tenure
  let installmentAmount: Money
  if (r === 0) {
    installmentAmount = n > 0 ? toMoney(principal / n) : 0
  } else {
    const pow = Math.pow(1 + r, n)
    const emi = (principal * r * pow) / (pow - 1)
    installmentAmount = toMoney(emi)
  }

  let balance = principal
  let due = new Date(input.startDate)
  let interestAccum = 0
  for (let i = 1; i <= n; i++) {
    const interestPart = mulMoney(balance, r)
    const principalPart = subMoney(installmentAmount, interestPart)
    balance = subMoney(balance, principalPart)
    interestAccum = addMoney(interestAccum, interestPart)
    schedule.push({
      installNo: i,
      dueDate: due,
      amount: installmentAmount,
      principalPart: Math.max(principalPart, 0),
      interestPart,
      balance: Math.max(balance, 0),
    })
    due = addPeriod(due, input.installmentFreq)
  }
  totalInterest = interestAccum
  const totalPayable = addMoney(principal, totalInterest)
  const firstDueDate = schedule[0]?.dueDate ?? input.startDate
  const maturityDate = schedule[schedule.length - 1]?.dueDate ?? input.startDate
  return {
    principal,
    totalInterest,
    totalPayable,
    installmentAmount,
    firstDueDate,
    maturityDate,
    schedule,
  }
}

// Helper: convert Decimal/Prisma values to numbers safely
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return parseFloat((v as { toString(): string }).toString()) || 0
  }
  return 0
}
