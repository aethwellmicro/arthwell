'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Inbox } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AnimatedNumber } from '@/components/animated-number'

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  fullValue,
  onClick,
  animateValue,
  animateFormat,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  fullValue?: string // optional: if value is compact, show full on hover
  onClick?: () => void // optional: makes the card clickable
  animateValue?: number // if provided with animateFormat, shows count-up animation
  animateFormat?: (n: number) => string // formatter for the animated number
}) {
  const tones: Record<string, string> = {
    default: 'bg-muted text-foreground border border-border',
    success: 'bg-muted text-foreground border border-border',
    warning: 'bg-muted text-foreground border border-border',
    danger: 'bg-muted text-foreground border border-border',
    info: 'bg-muted text-foreground border border-border',
  }
  const displayValue = (animateValue !== undefined && animateFormat) ? (
    <AnimatedNumber value={animateValue} format={animateFormat} />
  ) : value
  const valueEl = (
    <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground truncate">{displayValue}</p>
  )
  const inner = (
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          {fullValue && fullValue !== value ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block cursor-help" onClick={onClick}>{valueEl}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span className="font-mono text-xs">{fullValue}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            valueEl
          )}
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn('h-8 w-8 rounded-[6px] flex items-center justify-center shrink-0 border border-border bg-[#f5f5f5] dark:bg-[#171717] text-foreground')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </CardContent>
  )
  if (onClick) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        className="overflow-hidden transition-all hover:border-foreground/30 hover:shadow-xs duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring border-border bg-card rounded-[12px]"
      >
        {inner}
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden transition-all hover:border-foreground/20 hover:shadow-xs duration-150 border-border bg-card rounded-[12px]">
      {inner}
    </Card>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('rounded-[12px] border border-border shadow-xs overflow-hidden bg-card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border bg-card">
          <div>
            {title && <h3 className="font-semibold text-sm text-foreground tracking-tight">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-0">{children}</div>
    </Card>
  )
}

export function EmptyState({ message = 'No records found.', icon: Icon = Inbox }: { message?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  )
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

export function Badge2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}
