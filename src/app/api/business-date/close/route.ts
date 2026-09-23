import { POST as eodPost } from '@/app/api/business-date/eod/route'

export async function POST(req: Request) {
  return eodPost(req)
}
