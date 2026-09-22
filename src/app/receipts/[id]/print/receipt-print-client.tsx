'use client'

import { useEffect } from 'react'
import { Printer, ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReceiptPrint, ReceiptData } from '@/components/receipt-print'
import { useRouter } from 'next/navigation'

export function ReceiptPrintClient({ data }: { data: ReceiptData }) {
  const router = useRouter()

  useEffect(() => {
    // Automatically trigger print preview after rendering
    const timer = setTimeout(() => {
      window.print()
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 py-4 sm:py-8 px-2 sm:px-4">
      {/* Top action bar - hidden during print */}
      <div className="no-print max-w-md mx-auto mb-4 flex items-center justify-between gap-2 bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-sm border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) {
              router.back()
            } else {
              router.push('/receipts')
            }
          }}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
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

      {/* Printable Receipt Card */}
      <div className="max-w-md mx-auto bg-white shadow-md rounded-lg overflow-hidden border border-neutral-200">
        <ReceiptPrint data={data} />
      </div>

      {/* Mobile-friendly helper note */}
      <div className="no-print max-w-md mx-auto mt-4 text-center text-xs text-neutral-500">
        <p>On mobile phones, select <span className="font-semibold text-neutral-700 dark:text-neutral-300">Save as PDF</span> in the printer menu to download.</p>
      </div>
    </div>
  )
}
