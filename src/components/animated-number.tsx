'use client'

import { useCountUp } from '@/lib/use-count-up'

// Displays an animated count-up number with an optional formatter.
// Parses the numeric portion from the target string and animates it.
interface AnimatedNumberProps {
  value: number
  format: (n: number) => string // e.g., formatMoney or formatMoneyCompact or (n) => String(n)
  className?: string
  duration?: number
}

export function AnimatedNumber({ value, format, className, duration = 800 }: AnimatedNumberProps) {
  const animated = useCountUp(value, duration)
  return <span className={className}>{format(animated)}</span>
}
