'use client'

import { forwardRef } from 'react'
import { Wallet } from 'lucide-react'
import { formatMoney, formatDateTime } from '@/lib/format'

interface ReceiptData {
  receiptNumber: string
  branchName?: string
  customerName?: string
  customerId?: string
  mobile?: string
  accountNumber?: string
  collectionDate: string
  amount: number
  paymentMode: string
  collectedBy?: string
  previousOutstanding: number
  currentOutstanding: number
  remarks?: string
}

export const ReceiptPrint = forwardRef<HTMLDivElement, { data: ReceiptData }>(function ReceiptPrint(
  { data },
  ref
) {
  return (
    <div ref={ref} className="print-area bg-white text-black mx-auto max-w-md p-6 font-sans">
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center justify-center gap-3 mb-1">
          <img src="/arthwell-logo.svg" alt="ArthWell" className="h-12 w-12" />
          <span className="font-bold text-xl">ArthWell Micro Finance</span>
        </div>
        <p className="text-sm text-gray-700">{data.branchName || 'Main Branch - MG Road'}</p>
        <p className="text-xs text-gray-500">Collection Receipt</p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-gray-500">Receipt No.</p>
          <p className="font-bold font-mono">{data.receiptNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Date &amp; Time</p>
          <p className="font-semibold text-sm">{formatDateTime(data.collectionDate)}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <Row label="Customer Name" value={data.customerName || '—'} />
        <Row label="Customer ID" value={data.customerId || '—'} />
        <Row label="Mobile" value={data.mobile || '—'} />
        <Row label="Account Number" value={data.accountNumber || '—'} />
        <Row label="Payment Mode" value={data.paymentMode} />
        <Row label="Collected By" value={data.collectedBy || '—'} />
      </div>

      <div className="border-t-2 border-dashed border-gray-300 pt-3 mb-3">
        <div className="flex justify-between text-base">
          <span className="font-medium">Amount Received</span>
          <span className="font-bold text-emerald-700">{formatMoney(data.amount)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>Previous Outstanding</span>
          <span>{formatMoney(data.previousOutstanding)}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="font-medium">Current Outstanding</span>
          <span className="font-semibold">{formatMoney(data.currentOutstanding)}</span>
        </div>
      </div>

      {data.remarks && (
        <div className="mb-4">
          <p className="text-xs text-gray-500">Remarks</p>
          <p className="text-sm">{data.remarks}</p>
        </div>
      )}

      <div className="border-t border-gray-300 pt-3 text-center">
        <p className="text-xs text-gray-500">Thank you for your payment!</p>
        <p className="text-[10px] text-gray-400 mt-1">This is a system-generated receipt. Please retain for your records.</p>
      </div>
    </div>
  )
})

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b border-dashed border-gray-200 pb-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
