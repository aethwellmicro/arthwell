import { CustomersView } from '@/components/views/customers'

export default function CustomersPage({ params }: { params: { id?: string[] } }) {
  const customerId = params.id?.[0]
  return <CustomersView customerId={customerId} />
}
