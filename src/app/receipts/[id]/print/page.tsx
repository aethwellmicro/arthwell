import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { num } from '@/lib/calc'
import { ReceiptPrintClient } from './receipt-print-client'

export const dynamic = 'force-dynamic'

export default async function ReceiptStandalonePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const collection = await db.collection.findUnique({
    where: { id },
    include: {
      customer: { select: { customerId: true, fullName: true, primaryMobile: true } },
      account: { select: { accountNumber: true } },
      collectedBy: { select: { name: true, employeeCode: true } },
      receipt: true,
    },
  })

  if (!collection) {
    notFound()
  }

  // Increment print count
  if (collection.receipt) {
    try {
      await db.receipt.update({
        where: { id: collection.receipt.id },
        data: { printCount: { increment: 1 } },
      })
    } catch {}
  }

  const receiptData = {
    receiptNumber: collection.receiptNumber,
    branchName: collection.receipt?.branchName || 'Main Branch - MG Road',
    customerName: collection.customer?.fullName,
    customerId: collection.customer?.customerId,
    mobile: collection.customer?.primaryMobile,
    accountNumber: collection.account?.accountNumber,
    collectionDate: collection.collectionDate.toISOString(),
    amount: num(collection.amount),
    paymentMode: collection.paymentMode,
    collectedBy: collection.collectedBy?.name,
    previousOutstanding: num(collection.previousOutstanding),
    currentOutstanding: num(collection.currentOutstanding),
    remarks: collection.remarks || undefined,
  }

  return <ReceiptPrintClient data={receiptData} />
}
