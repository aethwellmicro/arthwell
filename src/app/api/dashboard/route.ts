import { db } from '@/lib/db'
import { json, withAuth, startOfDay, endOfDay, startOfWeek, startOfMonth, addMonths } from '@/lib/api'
import { num } from '@/lib/calc'
import { getBranchFilter } from '@/lib/branch'

let serverDashboardCache: { scopeKey: string; data: any; expiry: number } | null = null
const SERVER_CACHE_TTL = 3000 // 3 seconds burst cache

export async function GET(req: Request) {
  return withAuth(async (user) => {
    const url = new URL(req.url)
    const bypassCache = url.searchParams.get('refresh') === '1'
    const branchFilter = getBranchFilter(user)
    const installmentBranchFilter = user.role === 'ADMIN' ? {} : { account: { is: branchFilter } }
    const scopeKey = user.role === 'ADMIN' ? 'ADMIN' : `${user.role}:${user.branchId || 'UNASSIGNED'}`

    const nowTime = Date.now()
    if (!bypassCache && serverDashboardCache?.scopeKey === scopeKey && nowTime < serverDashboardCache.expiry) {
      return json(serverDashboardCache.data)
    }

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekStart = startOfWeek(now)
    const monthStart = startOfMonth(now)
    const sixMonthsAgo = addMonths(now, -6)
    const sevenDaysLater = new Date(now)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

    const [
      totalCustomers,
      activeCustomers,
      pendingCustomers,
      approvedCustomers,
      rejectedCustomers,
      disbursedCustomers,
      totalGroups,
      accounts,
      allCollections,
      todayCollections,
      weekCollections,
      monthCollections,
      sixMonthCollections,
      pendingApprovalList,
      employees,
      overdueInstallments,
      dueToday,
      upcomingInstallments,
    ] = await Promise.all([
      db.customer.count({ where: branchFilter }),
      db.customer.count({ where: { status: { in: ['ACTIVE', 'APPROVED', 'DISBURSED'] }, ...branchFilter } }),
      db.customer.count({ where: { status: 'PENDING_VERIFICATION', ...branchFilter } }),
      db.customer.count({ where: { status: 'APPROVED', ...branchFilter } }),
      db.customer.count({ where: { status: 'REJECTED', ...branchFilter } }),
      db.customer.count({ where: { status: 'DISBURSED', ...branchFilter } }),
      db.group.count({ where: branchFilter }),
      db.account.findMany({ where: branchFilter, select: { id: true, principal: true, totalPayable: true, status: true, startDate: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', ...branchFilter }, select: { amount: true, paymentMode: true, collectedById: true, collectionDate: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: todayStart, lte: todayEnd }, ...branchFilter }, include: { collectedBy: { select: { name: true } }, customer: { select: { fullName: true, customerId: true } }, account: { select: { accountNumber: true } } }, orderBy: { collectionDate: 'desc' } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: weekStart }, ...branchFilter }, select: { amount: true, paymentMode: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: monthStart }, ...branchFilter }, select: { amount: true, paymentMode: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: sixMonthsAgo }, ...branchFilter }, select: { amount: true, collectionDate: true, paymentMode: true } }),
      db.customer.findMany({
        where: { status: 'PENDING_VERIFICATION', ...branchFilter },
        include: {
          group: { select: { id: true, groupId: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.user.findMany({ where: branchFilter, select: { id: true, name: true, role: true } }),
      db.installment.findMany({
        where: { dueDate: { lt: now }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, ...installmentBranchFilter },
        include: { account: { include: { customer: { select: { fullName: true, customerId: true, primaryMobile: true } } } } },
      }),
      db.installment.findMany({
        where: { dueDate: { lte: todayEnd }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, ...installmentBranchFilter },
        select: { amount: true, paidAmount: true },
      }),
      db.installment.findMany({
        where: {
          dueDate: { gt: todayEnd, lte: sevenDaysLater },
          status: { in: ['PENDING', 'PARTIAL'] },
          ...installmentBranchFilter,
        },
        select: { amount: true, paidAmount: true, dueDate: true },
      }),
    ])

    const totalDisbursed = accounts.reduce((s, a) => s + num(a.principal), 0)
    const totalPayable = accounts.reduce((s, a) => s + num(a.totalPayable), 0)
    const totalCollected = allCollections.reduce((s, c) => s + num(c.amount), 0)
    const totalOutstanding = Math.max(totalPayable - totalCollected, 0)
    const todayCollectedAmount = todayCollections.reduce((s, c) => s + num(c.amount), 0)
    const weekCollected = weekCollections.reduce((s, c) => s + num(c.amount), 0)
    const monthCollected = monthCollections.reduce((s, c) => s + num(c.amount), 0)
    const sixMonthCollected = sixMonthCollections.reduce((s, c) => s + num(c.amount), 0)

    // by payment mode (all time)
    const byMode: Record<string, number> = {}
    for (const c of allCollections) byMode[c.paymentMode] = (byMode[c.paymentMode] || 0) + num(c.amount)
    // by employee
    const byEmployeeRaw: Record<string, number> = {}
    for (const c of allCollections) byEmployeeRaw[c.collectedById] = (byEmployeeRaw[c.collectedById] || 0) + num(c.amount)
    const byEmployee = employees
      .map((e) => ({ name: e.name, role: e.role, amount: byEmployeeRaw[e.id] || 0 }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const overdueAccountsMap = new Map<string, { accountNumber: string; customer: string; customerId: string; mobile: string; overdueAmount: number; oldestDueDate: Date; maxOverdueDays: number }>()
    for (const inst of overdueInstallments) {
      const due = num(inst.amount) - num(inst.paidAmount)
      if (due <= 0) continue
      const key = inst.accountId
      const overdueDays = Math.floor((now.getTime() - inst.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      const existing = overdueAccountsMap.get(key)
      if (existing) {
        existing.overdueAmount += due
        if (inst.dueDate < existing.oldestDueDate) {
          existing.oldestDueDate = inst.dueDate
          existing.maxOverdueDays = overdueDays
        }
      } else {
        overdueAccountsMap.set(key, {
          accountNumber: inst.account.accountNumber,
          customer: inst.account.customer.fullName,
          customerId: inst.account.customer.customerId,
          mobile: inst.account.customer.primaryMobile,
          overdueAmount: due,
          oldestDueDate: inst.dueDate,
          maxOverdueDays: overdueDays,
        })
      }
    }
    const overdueAccounts = Array.from(overdueAccountsMap.values()).sort((a, b) => b.overdueAmount - a.overdueAmount)
    const totalOverdue = overdueAccounts.reduce((s, a) => s + a.overdueAmount, 0)

    // aging buckets: 0-30, 31-60, 61-90, 90+ days
    const agingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const inst of overdueInstallments) {
      const due = num(inst.amount) - num(inst.paidAmount)
      if (due <= 0) continue
      const days = Math.floor((now.getTime() - inst.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      if (days <= 30) agingBuckets['0-30'] += due
      else if (days <= 60) agingBuckets['31-60'] += due
      else if (days <= 90) agingBuckets['61-90'] += due
      else agingBuckets['90+'] += due
    }

    // today's due (sum of installments due today or earlier that are unpaid)
    const todayDueAmount = dueToday.reduce((s, i) => s + (num(i.amount) - num(i.paidAmount)), 0)
    const todayPending = Math.max(todayDueAmount - todayCollectedAmount, 0)

    // projected collections for next 7 days (upcoming due installments)
    const projectedCollections = upcomingInstallments.reduce((s, i) => s + (num(i.amount) - num(i.paidAmount)), 0)
    // daily breakdown for next 7 days
    const projectedDaily: { date: string; amount: number }[] = []
    for (let d = 1; d <= 7; d++) {
      const dayStart = new Date(now)
      dayStart.setDate(dayStart.getDate() + d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      const dayAmount = upcomingInstallments
        .filter((i) => i.dueDate >= dayStart && i.dueDate <= dayEnd)
        .reduce((s, i) => s + (num(i.amount) - num(i.paidAmount)), 0)
      projectedDaily.push({ date: dayStart.toLocaleString('en', { weekday: 'short' }), amount: dayAmount })
    }

    // 6-month trend
    const trend: { month: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const mStart = startOfMonth(addMonths(now, -i))
      const mEnd = addMonths(mStart, 1)
      const sum = sixMonthCollections
        .filter((c) => c.collectionDate >= mStart && c.collectionDate < mEnd)
        .reduce((s, c) => s + num(c.amount), 0)
      trend.push({ month: mStart.toLocaleString('en', { month: 'short' }), amount: sum })
    }

    // accounts status breakdown
    const statusBreakdown = accounts.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const result = {
      stats: {
        totalCustomers,
        activeCustomers,
        totalAccounts: accounts.length,
        totalDisbursed,
        totalPayable,
        totalCollected,
        totalOutstanding,
        totalOverdue,
        todayCollected: todayCollectedAmount,
        todayDue: todayDueAmount,
        todayPending,
        weekCollected,
        monthCollected,
        sixMonthCollected,
        overdueAccountCount: overdueAccounts.length,
        projectedCollections,
        totalGroups,
        pendingCustomers,
        approvedCustomers,
        rejectedCustomers,
        disbursedCustomers,
      },
      pendingApprovals: pendingApprovalList.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        fullName: c.fullName,
        primaryMobile: c.primaryMobile,
        amount: c.amount ? num(c.amount) : 0,
        branch: c.branch,
        status: c.status,
        createdAt: c.createdAt,
        group: c.group ? { id: c.group.id, groupId: c.group.groupId, name: c.group.name } : null,
        createdBy: c.createdBy ? { id: c.createdBy.id, name: c.createdBy.name } : null,
      })),
      byMode,
      byEmployee,
      overdueAccounts: overdueAccounts.slice(0, 10),
      todayCollections: todayCollections.slice(0, 10).map((c) => ({
        id: c.id,
        receiptNumber: c.receiptNumber,
        amount: num(c.amount),
        paymentMode: c.paymentMode,
        customerName: c.customer.fullName,
        customerId: c.customer.customerId,
        accountNumber: c.account.accountNumber,
        collectedBy: c.collectedBy.name,
        time: c.collectionDate,
      })),
      trend,
      statusBreakdown,
      agingBuckets,
      projectedDaily,
    }

    serverDashboardCache = {
      scopeKey,
      data: result,
      expiry: Date.now() + SERVER_CACHE_TTL,
    }

    return json(result)
  })
}
