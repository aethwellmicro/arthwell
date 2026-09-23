import { GET as eodReportGet } from '@/app/api/business-date/eod/report/route'

export async function GET(req: Request) {
  return eodReportGet(req)
}
