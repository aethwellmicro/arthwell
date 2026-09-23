'use client'

import { useEffect } from 'react'
import { Printer, ArrowLeft, Download, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomerStatement } from '@/components/customer-statement'
import { useRouter } from 'next/navigation'
import { formatMoney } from '@/lib/format'

export function CustomerStatementClient({
  customer,
  account,
  totalPayable,
  totalCollected,
  outstanding,
  entries,
  branchName,
}: {
  customer: any
  account?: any
  totalPayable: number
  totalCollected: number
  outstanding: number
  entries: any[]
  branchName?: string
}) {
  const router = useRouter()

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 py-4 sm:py-8 px-2 sm:px-4">
      {/* Top action bar - hidden during print */}
      <div className="no-print max-w-4xl mx-auto mb-4 flex items-center justify-between gap-2 bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-bold">Loan Account Statement</h2>
            <p className="text-xs text-muted-foreground">{customer.fullName} ({customer.customerId})</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Main Statement Card - Always visible on screen and printed */}
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg overflow-hidden border border-neutral-200 p-4 sm:p-8">
        <CustomerStatement
          customer={customer}
          account={account}
          totalPayable={totalPayable}
          totalCollected={totalCollected}
          outstanding={outstanding}
          entries={entries}
          branchName={branchName}
          alwaysVisible={true}
        />
      </div>

      <div className="no-print max-w-4xl mx-auto mt-4 text-center text-xs text-neutral-500">
        <p>ArthWell Micro Finance — Official Verified Customer Statement</p>
      </div>
    </div>
  )
}
