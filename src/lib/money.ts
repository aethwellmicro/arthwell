// Decimal-safe money handling. Stored as Decimal in Prisma; we round to 2 decimals
// using integer math to avoid floating point drift.

export type Money = number

const ROUND = 100 // 2 decimal places

export function toMoney(v: number | string | { toString(): string }): Money {
  const n = typeof v === 'number' ? v : parseFloat(v.toString())
  if (!isFinite(n)) return 0
  return Math.round(n * ROUND) / ROUND
}

export function addMoney(...vals: Money[]): Money {
  const sum = vals.reduce((acc, v) => acc + Math.round(v * ROUND), 0)
  return sum / ROUND
}

export function subMoney(a: Money, b: Money): Money {
  return (Math.round(a * ROUND) - Math.round(b * ROUND)) / ROUND
}

export function mulMoney(a: Money, factor: number): Money {
  return Math.round(a * ROUND * factor) / ROUND
}

export function cmpMoney(a: Money, b: Money): number {
  return Math.round(a * ROUND) - Math.round(b * ROUND)
}

export function formatMoney(v: Money): string {
  const n = typeof v === 'number' ? v : Number(v)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)
}

export function formatMoneyPlain(v: Money): string {
  const n = typeof v === 'number' ? v : Number(v)
  return (n || 0).toFixed(2)
}
