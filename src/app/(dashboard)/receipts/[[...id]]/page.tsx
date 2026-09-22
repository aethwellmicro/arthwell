import { ReceiptsView } from '@/components/views/receipts'

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ id?: string[] }>
}) {
  const resolvedParams = await params
  const receiptId = resolvedParams.id?.[0]
  return <ReceiptsView receiptId={receiptId} />
}
