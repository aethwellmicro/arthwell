'use client'

import { formatMoney, formatDate, formatDateTime } from '@/lib/format'

export interface StatementEntry {
  date: string
  particulars?: string
  receiptNumber: string
  accountNumber: string
  debit?: number
  credit?: number
  amount?: number
  side?: 'DEBIT' | 'CREDIT'
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
  account?: {
    accountNumber: string
    principal?: number
    processingFee?: number
    insurancePremium?: number
    totalFees?: number
  } | null
  totalPayable: number
  totalCollected: number
  outstanding: number
  entries: StatementEntry[]
  branchName?: string
  alwaysVisible?: boolean
}

export function CustomerStatement({
  customer,
  account,
  totalPayable,
  totalCollected,
  outstanding,
  entries,
  branchName = 'Main Branch - MG Road',
  alwaysVisible = false,
}: CustomerStatementProps) {
  const now = new Date()

  // Calculate total debits and credits across entries
  const totalDebits = entries.reduce((s, e) => s + (e.debit !== undefined ? e.debit : (e.side === 'DEBIT' ? (e.amount || 0) : 0)), 0)
  const totalCredits = entries.reduce((s, e) => s + (e.credit !== undefined ? e.credit : (e.side === 'CREDIT' ? (e.amount || 0) : (e.debit === undefined ? (e.amount || 0) : 0))), 0)

  return (
    <div className={`print-report ${alwaysVisible ? 'block' : 'hidden print:block'} font-sans text-black`}>
      {/* Header */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/arthwell-logo.png" alt="ArthWell" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-2xl font-bold">ArthWell Micro Finance</h1>
              <p className="text-sm text-gray-700">{branchName}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Generated: {formatDateTime(now)}</p>
            <p>Statement ID: STMT-{now.getTime().toString(36).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-lg font-bold">Customer Account &amp; Loan Ledger Statement</h2>
        <p className="text-sm text-gray-600">Complete Debit (Dr) &amp; Credit (Cr) transaction history</p>
      </div>

      {/* Customer info */}
      <div className="grid grid-cols-2 gap-4 mb-4 border border-gray-300 rounded p-3">
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Customer ID:</span> <span className="font-bold">{customer.customerId}</span></p>
          <p><span className="text-gray-600">Name:</span> <span className="font-bold">{customer.fullName}</span></p>
          <p><span className="text-gray-600">Mobile:</span> {customer.primaryMobile}</p>
          {account && (
            <p><span className="text-gray-600">Loan Account:</span> <span className="font-bold font-mono">{account.accountNumber}</span></p>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Sanctioned Amount:</span> <span className="font-bold">{customer.amount ? formatMoney(customer.amount) : '—'}</span></p>
          <p><span className="text-gray-600">Area:</span> {customer.area || '—'}</p>
          <p><span className="text-gray-600">City:</span> {customer.city || '—'}</p>
          <p><span className="text-gray-600">Address:</span> {customer.address || '—'}</p>
        </div>
      </div>

      {/* Recovered / Deducted Charges Callout (Credit Side) */}
      {account && account.totalFees && account.totalFees > 0 ? (
        <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-300 rounded text-xs flex justify-between items-center text-emerald-950">
          <div>
            <span className="font-bold text-emerald-800 uppercase tracking-wide mr-2">Deducted / Recovered Charges:</span>
            <span>Proc. Fee: {formatMoney(account.processingFee || 0)} + Insurance: {formatMoney(account.insurancePremium || 0)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-emerald-700 mr-1.5 font-medium">Recorded on Credit (Cr) side:</span>
            <span className="font-bold text-sm text-emerald-700">{formatMoney(account.totalFees)}</span>
          </div>
        </div>
      ) : null}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4 border border-gray-300 rounded p-3">
        <div className="text-center">
          <p className="text-[10px] uppercase text-gray-500">Total Payable (Dr)</p>
          <p className="font-bold text-sm">{formatMoney(totalPayable)}</p>
        </div>
        <div className="text-center border-l border-gray-300">
          <p className="text-[10px] uppercase text-gray-500">Total Collections (Cr)</p>
          <p className="font-bold text-sm text-emerald-700">{formatMoney(totalCollected)}</p>
        </div>
        <div className="text-center border-l border-gray-300">
          <p className="text-[10px] uppercase text-gray-500">Total Credits (Cr)</p>
          <p className="font-bold text-sm text-emerald-700">{formatMoney(totalCredits > 0 ? totalCredits : totalCollected)}</p>
        </div>
        <div className="text-center border-l border-gray-300">
          <p className="text-[10px] uppercase text-gray-500">Outstanding Balance</p>
          <p className="font-bold text-sm text-amber-700">{formatMoney(outstanding)}</p>
        </div>
      </div>

      {/* Transaction table */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-black bg-gray-100">
            <th className="px-2 py-1.5 text-left font-bold">Date</th>
            <th className="px-2 py-1.5 text-left font-bold">Particulars / Details</th>
            <th className="px-2 py-1.5 text-left font-bold">Ref / Receipt</th>
            <th className="px-2 py-1.5 text-right font-bold text-rose-800">Debit (Dr)</th>
            <th className="px-2 py-1.5 text-right font-bold text-emerald-800">Credit (Cr)</th>
            <th className="px-2 py-1.5 text-left font-bold">Mode</th>
            <th className="px-2 py-1.5 text-left font-bold">Staff / Channel</th>
            <th className="px-2 py-1.5 text-right font-bold">Balance</th>
            <th className="px-2 py-1.5 text-left font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const isDebit = e.debit !== undefined ? e.debit > 0 : e.side === 'DEBIT'
            const debitAmt = e.debit !== undefined ? e.debit : (isDebit ? (e.amount || 0) : 0)
            const creditAmt = e.credit !== undefined ? e.credit : (!isDebit ? (e.amount || 0) : 0)

            return (
              <tr key={i} className="border-b border-gray-300">
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(e.date)}</td>
                <td className="px-2 py-1.5 font-medium">
                  {e.particulars || (isDebit ? 'Loan Disbursement' : 'EMI Collection Received')}
                </td>
                <td className="px-2 py-1.5 font-mono">{e.receiptNumber || '—'}</td>
                <td className="px-2 py-1.5 text-right font-semibold text-rose-700 whitespace-nowrap">
                  {debitAmt > 0 ? formatMoney(debitAmt) : '—'}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                  {creditAmt > 0 ? formatMoney(creditAmt) : '—'}
                </td>
                <td className="px-2 py-1.5">{e.paymentMode}</td>
                <td className="px-2 py-1.5">{e.collectedBy}</td>
                <td className="px-2 py-1.5 text-right font-medium">{formatMoney(e.balanceAfter)}</td>
                <td className="px-2 py-1.5 font-medium">
                  <span className={creditAmt > 0 ? 'text-emerald-700' : 'text-gray-800'}>{e.status}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {entries.length === 0 && (
        <p className="text-center text-gray-500 py-4">No transactions recorded yet.</p>
      )}

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between">
        <span>ArthWell Micro Finance - Customer Loan Ledger (Deductions &amp; Recoveries on Credit Side)</span>
        <span>This is an official system-generated statement.</span>
      </div>
    </div>
  )
}
