import { AccountsView } from '@/components/views/accounts'

export default function AccountsPage({ params }: { params: { id?: string[] } }) {
  const accountId = params.id?.[0]
  return <AccountsView accountId={accountId} />
}
