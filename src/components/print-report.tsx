'use client'

import { formatMoney, formatDate, formatDateTime } from '@/lib/format'

interface PrintReportProps {
  title: string
  subtitle?: string
  dateFrom?: string | Date | null
  dateTo?: string | Date | null
  summary?: { label: string; value: string }[]
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center' }[]
  rows: Record<string, any>[]
  branchName?: string
}

export function PrintReport({
  title,
  subtitle,
  dateFrom,
  dateTo,
  summary,
  columns,
  rows,
  branchName = 'Main Branch - MG Road',
}: PrintReportProps) {
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
            <p>Report ID: RPT-{now.getTime().toString(36).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        {(dateFrom || dateTo) && (
          <p className="text-xs text-gray-500">
            Period: {dateFrom ? formatDate(dateFrom) : 'Start'} to {dateTo ? formatDate(dateTo) : 'Now'}
          </p>
        )}
      </div>

      {/* Summary */}
      {summary && summary.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-4 border border-gray-300 rounded p-2">
          {summary.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-[10px] uppercase text-gray-500">{s.label}</p>
              <p className="font-bold text-sm">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-black bg-gray-100">
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-2 py-1.5 font-bold ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-300">
              {columns.map((c, j) => {
                const v = row[c.key]
                let display: string
                if (v === null || v === undefined) display = ''
                else if (typeof v === 'number') {
                  // money columns detected by name
                  const moneyKeys = ['amount', 'totalPayable', 'paidAmount', 'outstanding', 'principal', 'paid', 'overdueAmount', 'previousOutstanding', 'currentOutstanding', 'balanceAfter', 'total', 'cash', 'upi', 'bank', 'other', 'cashTotal', 'upiTotal', 'bankTotal', 'otherTotal', 'disbursed', 'payable']
                  display = moneyKeys.includes(c.key) ? formatMoney(v) : String(v)
                } else if (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))) {
                  display = formatDate(v)
                } else if (typeof v === 'object') {
                  display = JSON.stringify(v)
                } else {
                  display = String(v)
                }
                return (
                  <td
                    key={j}
                    className={`px-2 py-1 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between">
        <span>LoanLedger - Internal Collection & Loan Management System</span>
        <span>Total rows: {rows.length}</span>
      </div>
    </div>
  )
}
