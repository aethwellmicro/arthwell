'use client'

import { forwardRef } from 'react'
import { formatMoney, formatDateTime } from '@/lib/format'

export interface ReceiptData {
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

export const ReceiptPrint = forwardRef<HTMLDivElement, { data: ReceiptData; className?: string }>(
  function ReceiptPrint({ data, className }, ref) {
    return (
      <div
        ref={ref}
        className={`print-area bg-white text-black mx-auto w-full max-w-sm sm:max-w-md p-4 sm:p-6 font-sans text-xs sm:text-sm select-text ${className || ''}`}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3 mb-3 sm:mb-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1">
            <img src="/arthwell-logo.png" alt="ArthWell" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
            <span className="font-bold text-lg sm:text-xl tracking-tight">ArthWell Micro Finance</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-700 font-medium">{data.branchName || 'Main Branch - MG Road'}</p>
          <p className="text-[11px] sm:text-xs text-gray-500 uppercase tracking-wider mt-0.5">Payment Collection Receipt</p>
        </div>

        {/* Receipt No & Date */}
        <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2 border-b border-gray-200">
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Receipt No</p>
            <p className="font-bold font-mono text-xs sm:text-sm text-gray-900">{data.receiptNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Date &amp; Time</p>
            <p className="font-semibold text-xs sm:text-sm text-gray-900">{formatDateTime(data.collectionDate)}</p>
          </div>
        </div>

        {/* Key-Value Details */}
        <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
          <Row label="Customer Name" value={data.customerName || '—'} bold />
          <Row label="Customer ID" value={data.customerId || '—'} mono />
          <Row label="Mobile Number" value={data.mobile || '—'} />
          <Row label="Loan Account" value={data.accountNumber || '—'} mono />
          <Row label="Payment Mode" value={data.paymentMode} />
          <Row label="Collected By" value={data.collectedBy || '—'} />
        </div>

        {/* Amount Box */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 mb-3 bg-gray-50/70 p-2.5 rounded">
          <div className="flex justify-between items-center text-sm sm:text-base">
            <span className="font-semibold text-gray-800">Amount Received</span>
            <span className="font-bold text-base sm:text-lg text-emerald-700">{formatMoney(data.amount)}</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm text-gray-600 mt-1.5 pt-1.5 border-t border-gray-200">
            <span>Previous Outstanding</span>
            <span>{formatMoney(data.previousOutstanding)}</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm text-gray-800 mt-1 font-medium">
            <span>Current Balance Remaining</span>
            <span className="font-bold text-gray-900">{formatMoney(data.currentOutstanding)}</span>
          </div>
        </div>

        {data.remarks && (
          <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Remarks</p>
            <p className="text-gray-700 italic">{data.remarks}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-300 pt-3 text-center">
          <p className="text-xs font-semibold text-gray-700">Thank you for your payment!</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            This is an authentic system-generated digital receipt. Retain for records.
          </p>
        </div>
      </div>
    )
  }
)

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs sm:text-sm border-b border-dashed border-gray-200 pb-1 gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-right truncate ${bold ? 'font-semibold text-gray-900' : 'text-gray-800'} ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
