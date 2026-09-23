import { db } from '@/lib/db'
import { json, error, withAuth } from '@/lib/api'
import { parseCalendarDate, num } from '@/lib/calc'

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const employeeIdFilter = searchParams.get('employeeId') || undefined
    const targetDate = parseCalendarDate(dateStr)

    // Find all installments due on targetDate (or overdue prior to targetDate)
    const installments = await db.installment.findMany({
      where: {
        dueDate: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0),
          lte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999),
        },
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      include: {
        account: {
          include: {
            customer: {
              include: {
                group: { select: { id: true, groupId: true, name: true, branch: true } },
                createdBy: { select: { id: true, name: true, employeeCode: true, role: true } },
              },
            },
          },
        },
      },
      orderBy: { installNo: 'asc' },
    })

    // Filter to user's assigned portfolio if Field Officer or employeeId param
    let filteredInstallments = installments
    if (user.role === 'COLLECTION_EMPLOYEE') {
      filteredInstallments = installments.filter(
        (i) => i.account.customer.createdById === user.id
      )
    } else if (employeeIdFilter && employeeIdFilter !== 'ALL') {
      filteredInstallments = installments.filter(
        (i) => i.account.customer.createdById === employeeIdFilter
      )
    }

    // Group by Field Officer / Collection Employee
    const officerMap = new Map<string, {
      officerId: string
      officerName: string
      officerCode: string
      totalCustomers: number
      totalDue: number
      totalCollected: number
      totalPending: number
      customers: any[]
    }>()

    let grandTotalDue = 0
    let grandTotalCollected = 0
    let grandTotalPending = 0

    for (const inst of filteredInstallments) {
      const officer = inst.account.customer.createdBy
      const officerId = officer.id
      const officerName = officer.name
      const officerCode = officer.employeeCode || '—'

      let groupRecord = officerMap.get(officerId)
      if (!groupRecord) {
        groupRecord = {
          officerId,
          officerName,
          officerCode,
          totalCustomers: 0,
          totalDue: 0,
          totalCollected: 0,
          totalPending: 0,
          customers: [],
        }
        officerMap.set(officerId, groupRecord)
      }

      const dueAmount = num(inst.amount)
      const paid = num(inst.paidAmount)
      const pending = Math.max(dueAmount - paid, 0)
      const savings = num(inst.savingsPart) || 100

      groupRecord.totalCustomers++
      groupRecord.totalDue += dueAmount + savings
      groupRecord.totalCollected += paid
      groupRecord.totalPending += pending + (paid >= dueAmount ? 0 : savings)

      grandTotalDue += dueAmount + savings
      grandTotalCollected += paid
      grandTotalPending += pending + (paid >= dueAmount ? 0 : savings)

      groupRecord.customers.push({
        installmentId: inst.id,
        installNo: inst.installNo,
        dueDate: inst.dueDate.toISOString().slice(0, 10),
        customerId: inst.account.customer.id,
        customerRefId: inst.account.customer.customerId,
        customerName: inst.account.customer.fullName,
        mobile: inst.account.customer.primaryMobile,
        groupId: inst.account.customer.group?.groupId || '—',
        groupName: inst.account.customer.group?.name || 'No Group',
        accountId: inst.account.id,
        accountNumber: inst.account.accountNumber,
        emi: dueAmount,
        savings,
        totalDue: dueAmount + savings,
        paid,
        pending: pending + (paid >= dueAmount ? 0 : savings),
        status: inst.status,
      })
    }

    return json({
      date: dateStr,
      grandTotals: {
        totalCustomers: filteredInstallments.length,
        totalDue: grandTotalDue,
        totalCollected: grandTotalCollected,
        totalPending: grandTotalPending,
      },
      officers: Array.from(officerMap.values()),
    })
  })
}
