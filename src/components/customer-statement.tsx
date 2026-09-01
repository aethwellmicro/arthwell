'use client'

import { formatMoney, formatDate, formatDateTime } from '@/lib/format'

interface StatementEntry {
  date: string
  receiptNumber: string
  accountNumber: string
  amount: number
  paymentMode: string
  collectedBy: string
  balanceAfter: number
  status: string
}

interface CustomerStatementProps {
  customer: {
    customerId: string
    fullName: string
    primaryMobile: string
    area?: string | null
    city?: string | null
    address?: string | null
    amount?: number | null
  }
  totalPayable: number
  totalCollected: number
  outstanding: number
  entries: StatementEntry[]
  branchName?: string
}

export function CustomerStatement({
  customer,
  totalPayable,
  totalCollected,
  outstanding,
  entries,
  branchName = 'Main Branch - MG Road',
}: CustomerStatementProps) {
  const now = new Date()
  return (
    <div className="print-report hidden print:block font-sans text-black">
      {/* Header */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">LoanLedger</h1>
            <p className="text-sm text-gray-700">{branchName}</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Generated: {formatDateTime(now)}</p>
            <p>Statement ID: STMT-{now.getTime().toString(36).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-lg font-bold">Customer Payment Statement</h2>
        <p className="text-sm text-gray-600">Complete transaction history</p>
      </div>

      {/* Customer info */}
      <div className="grid grid-cols-2 gap-4 mb-4 border border-gray-300 rounded p-3">
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Customer ID:</span> <span className="font-bold">{customer.customerId}</span></p>
          <p><span className="text-gray-600">Name:</span> <span className="font-bold">{customer.fullName}</span></p>
          <p><span className="text-gray-600">Mobile:</span> {customer.primaryMobile}</p>
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Amount:</span> <span className="font-bold">{customer.amount ? formatMoney(customer.amount) : '—'}</span></p>
          <p><span className="text-gray-600">Area:</span> {customer.area || '—'}</p>
          <p><span className="text-gray-600">City:</span> {customer.city || '—'}</p>
          <p><span className="text-gray-600">Address:</span> {customer.address || '—'}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 border border-gray-300 rounded p-3">
        <div className="text-center">
          <p className="text-[10px] uppercase text-gray-500">Total Payable</p>
          <p className="font-bold text-sm">{formatMoney(totalPayable)}</p>
        </div>
        <div className="text-center border-x border-gray-300">
          <p className="text-[10px] uppercase text-gray-500">Total Collected</p>
          <p className="font-bold text-sm text-emerald-700">{formatMoney(totalCollected)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase text-gray-500">Outstanding</p>
          <p className="font-bold text-sm text-amber-700">{formatMoney(outstanding)}</p>
        </div>
      </div>

      {/* Transaction table */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-black bg-gray-100">
            <th className="px-2 py-1.5 text-left font-bold">Date</th>
            <th className="px-2 py-1.5 text-left font-bold">Receipt</th>
            <th className="px-2 py-1.5 text-left font-bold">Account</th>
            <th className="px-2 py-1.5 text-right font-bold">Amount</th>
            <th className="px-2 py-1.5 text-left font-bold">Mode</th>
            <th className="px-2 py-1.5 text-left font-bold">Collector</th>
            <th className="px-2 py-1.5 text-right font-bold">Balance</th>
            <th className="px-2 py-1.5 text-left font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-gray-300">
              <td className="px-2 py-1">{formatDate(e.date)}</td>
              <td className="px-2 py-1 font-mono">{e.receiptNumber}</td>
              <td className="px-2 py-1 font-mono">{e.accountNumber}</td>
              <td className="px-2 py-1 text-right font-bold">{formatMoney(e.amount)}</td>
              <td className="px-2 py-1">{e.paymentMode}</td>
              <td className="px-2 py-1">{e.collectedBy}</td>
              <td className="px-2 py-1 text-right">{formatMoney(e.balanceAfter)}</td>
              <td className="px-2 py-1">{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <p className="text-center text-gray-500 py-4">No transactions recorded yet.</p>
      )}

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between">
        <span>LoanLedger - Internal Collection & Loan Management System</span>
        <span>This is a system-generated statement.</span>
      </div>
    </div>
  )
}
