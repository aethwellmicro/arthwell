'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type SortDir = 'asc' | 'desc' | null

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSort: string | null
  currentDir: SortDir
  onSort: (key: string) => void
  align?: 'left' | 'right' | 'center'
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  align = 'left',
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey
  const Icon = isActive ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      className={cn(
        'px-3 py-2.5 font-medium whitespace-nowrap',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(sortKey)}
        className={cn(
          'h-auto p-0 px-1 text-xs font-medium hover:bg-transparent hover:text-foreground',
          align === 'right' && 'ml-auto',
          isActive ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
        <Icon className={cn('h-3 w-3 ml-1', isActive ? 'opacity-100' : 'opacity-40')} />
      </Button>
    </th>
  )
}

// Helper to sort an array of objects by a key
export function sortArray<T>(items: T[], key: string, dir: 'asc' | 'desc'): T[] {
  const sorted = [...items].sort((a: any, b: any) => {
    let av = a[key]
    let bv = b[key]
    // Handle nested keys like 'customer.fullName'
    if (key.includes('.')) {
      const parts = key.split('.')
      av = parts.reduce((obj: any, p) => obj?.[p], a)
      bv = parts.reduce((obj: any, p) => obj?.[p], b)
    }
    // Handle null/undefined
    if (av == null) return 1
    if (bv == null) return -1
    // Numbers
    if (typeof av === 'number' && typeof bv === 'number') {
      return dir === 'asc' ? av - bv : bv - av
    }
    // Dates (ISO strings)
    if (typeof av === 'string' && /^\d{4}-\d{2}-\d{2}/.test(av)) {
      const ad = new Date(av).getTime()
      const bd = new Date(bv).getTime()
      return dir === 'asc' ? ad - bd : bd - ad
    }
    // Strings
    const as = String(av).toLowerCase()
    const bs = String(bv).toLowerCase()
    return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
  })
  return sorted
}
