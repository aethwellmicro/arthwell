import { db } from '@/lib/db'
import { json, withAuth } from '@/lib/api'
import { num } from '@/lib/calc'

// Reports endpoint supporting types:
//   daily, weekly, monthly, sixmonthly, yearly, customer, employee, paymentmode, outstanding, overdue, accountstatus, reconciliation
export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'daily'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const customerId = searchParams.get('customerId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const employeeId = searchParams.get('employeeId') || undefined
    const paymentMode = searchParams.get('paymentMode') || undefined
    const status = searchParams.get('status') || undefined
    const area = searchParams.get('area') || undefined

    const now = new Date()
    let dateFrom: Date | undefined
    let dateTo: Date | undefined
    if (from) dateFrom = new Date(from)
    if (to) dateTo = new Date(to + 'T23:59:59')

    // Default date ranges per type if no explicit range
    if (!dateFrom || !dateTo) {
      switch (type) {
        case 'daily':
          dateFrom = new Date(now); dateFrom.setHours(0, 0, 0, 0)
          dateTo = new Date(now); dateTo.setHours(23, 59, 59, 999)
          break
        case 'weekly': {
          const d = new Date(now); const day = (d.getDay() + 6) % 7
          dateFrom = new Date(d); dateFrom.setDate(d.getDate() - day); dateFrom.setHours(0, 0, 0, 0)
          dateTo = new Date(dateFrom); dateTo.setDate(dateFrom.getDate() + 6); dateTo.setHours(23, 59, 59, 999)
          break
        }
        case 'monthly':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
          dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          break
        case 'sixmonthly':
          dateFrom = new Date(now.getFullYear(), Math.floor(now.getMonth() / 6) * 6, 1)
          dateTo = new Date(now.getFullYear(), dateFrom.getMonth() + 6, 0, 23, 59, 59, 999)
          break
        case 'yearly':
          dateFrom = new Date(now.getFullYear(), 0, 1)
          dateTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
          break
      }
    }

    const where: any = { status: status || 'SUCCESSFUL' }
    if (dateFrom || dateTo) {
      where.collectionDate = {}
      if (dateFrom) where.collectionDate.gte = dateFrom
      if (dateTo) where.collectionDate.lte = dateTo
    }
    if (customerId) where.customerId = customerId
    if (accountId) where.accountId = accountId
    if (employeeId) where.collectedById = employeeId
    if (paymentMode) where.paymentMode = paymentMode
    if (area) where.customer = { area: { contains: area } }

    const collections = await db.collection.findMany({
      where,
      include: {
        customer: { select: { customerId: true, fullName: true, primaryMobile: true, area: true } },
        account: { select: { accountNumber: true } },
        collectedBy: { select: { name: true, employeeCode: true, role: true } },
      },
      orderBy: { collectionDate: 'desc' },
    })

    const items = collections.map((c) => ({
      id: c.id,
      receiptNumber: c.receiptNumber,
      collectionDate: c.collectionDate,
      customerId: c.customer.customerId,
      customerName: c.customer.fullName,
      mobile: c.customer.primaryMobile,
      area: c.customer.area,
      accountNumber: c.account.accountNumber,
      amount: num(c.amount),
      paymentMode: c.paymentMode,
      collectedBy: c.collectedBy.name,
      collectedByCode: c.collectedBy.employeeCode,
      status: c.status,
      remarks: c.remarks,
    }))

    const total = items.reduce((s, c) => s + (c.status === 'SUCCESSFUL' ? c.amount : 0), 0)
    const count = items.length

    // grouping helpers
    const groupSum = <T extends Record<string, any>>(arr: T[], key: string) => {
      const m: Record<string, { count: number; total: number }> = {}
      for (const it of arr) {
        const k = String(it[key] || 'Unknown')
        if (!m[k]) m[k] = { count: 0, total: 0 }
        if (it.status === 'SUCCESSFUL') m[k].total += it.amount
        m[k].count += 1
      }
      return Object.entries(m).map(([k, v]) => ({ key: k, ...v }))
    }

    let summary: any = {
      type,
      dateFrom,
      dateTo,
      total,
      count,
      cashTotal: items.filter((i) => i.paymentMode === 'CASH').reduce((s, i) => s + i.amount, 0),
      upiTotal: items.filter((i) => i.paymentMode === 'UPI').reduce((s, i) => s + i.amount, 0),
      bankTotal: items.filter((i) => i.paymentMode === 'BANK').reduce((s, i) => s + i.amount, 0),
      otherTotal: items.filter((i) => i.paymentMode === 'OTHER').reduce((s, i) => s + i.amount, 0),
    }

    let grouped: any[] | null = null
    let reportItems = items

    if (type === 'customer') {
      grouped = groupSum(items, 'customerName')
    } else if (type === 'employee') {
      grouped = groupSum(items, 'collectedBy')
    } else if (type === 'paymentmode') {
      grouped = groupSum(items, 'paymentMode')
    } else if (type === 'outstanding' || type === 'overdue') {
      // outstanding / overdue from accounts, not collections
      const accounts = await db.account.findMany({
        where: { status: type === 'overdue' ? { in: ['OVERDUE', 'ACTIVE'] } : undefined },
        include: { customer: { select: { fullName: true, customerId: true, primaryMobile: true, area: true } } },
      })
      const rows = []
      for (const a of accounts) {
        const collected = await db.collection.aggregate({ where: { accountId: a.id, status: 'SUCCESSFUL' }, _sum: { amount: true } })
        const paid = num(collected._sum.amount)
        const totalPayable = num(a.totalPayable)
        const outstanding = Math.max(totalPayable - paid, 0)
        const installments = await db.installment.findMany({ where: { accountId: a.id, dueDate: { lt: now } }, select: { amount: true, paidAmount: true, status: true } })
        const overdueAmount = installments.reduce((s, i) => s + (num(i.amount) - num(i.paidAmount)), 0)
        const overdueDays = installments.length > 0 ? Math.floor((now.getTime() - new Date(a.startDate).getTime()) / (24 * 60 * 60 * 1000)) : 0
        if (type === 'outstanding' && outstanding <= 0.01) continue
        if (type === 'overdue' && overdueAmount <= 0.01) continue
        rows.push({
          accountNumber: a.accountNumber,
          customerId: a.customer.customerId,
          customerName: a.customer.fullName,
          mobile: a.customer.primaryMobile,
          area: a.customer.area,
          totalPayable,
          paid,
          outstanding,
          overdueAmount,
          overdueDays,
          status: a.status,
          maturityDate: a.maturityDate,
        })
      }
      summary.total = rows.reduce((s, r) => s + r.outstanding, 0)
      summary.overdueTotal = rows.reduce((s, r) => s + r.overdueAmount, 0)
      summary.count = rows.length
      return json({ summary, items: rows })
    } else if (type === 'accountstatus') {
      const accounts = await db.account.findMany({ select: { status: true, principal: true, totalPayable: true } })
      const m: Record<string, { count: number; disbursed: number; payable: number }> = {}
      for (const a of accounts) {
        if (!m[a.status]) m[a.status] = { count: 0, disbursed: 0, payable: 0 }
        m[a.status].count += 1
        m[a.status].disbursed += num(a.principal)
        m[a.status].payable += num(a.totalPayable)
      }
      grouped = Object.entries(m).map(([k, v]) => ({ key: k, ...v }))
      return json({ summary, items: grouped })
    } else if (type === 'reconciliation') {
      // reconciliation: cash vs digital per employee
      const byEmp: Record<string, { cash: number; upi: number; bank: number; other: number; total: number; count: number }> = {}
      for (const it of items) {
        const k = it.collectedBy
        if (!byEmp[k]) byEmp[k] = { cash: 0, upi: 0, bank: 0, other: 0, total: 0, count: 0 }
        if (it.paymentMode === 'CASH') byEmp[k].cash += it.amount
        else if (it.paymentMode === 'UPI') byEmp[k].upi += it.amount
        else if (it.paymentMode === 'BANK') byEmp[k].bank += it.amount
        else byEmp[k].other += it.amount
        byEmp[k].total += it.amount
        byEmp[k].count += 1
      }
      grouped = Object.entries(byEmp).map(([k, v]) => ({ key: k, ...v }))
      return json({ summary, items: grouped })
    }

    return json({ summary, items: reportItems, grouped })
  })
}
