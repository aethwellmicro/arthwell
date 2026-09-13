import { ReceiptsView } from '@/components/views/receipts'

export default function ReceiptsPage({ params }: { params: { id?: string[] } }) {
  const receiptId = params.id?.[0]
  return <ReceiptsView receiptId={receiptId} />
}
