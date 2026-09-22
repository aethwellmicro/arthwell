import { db } from '@/lib/db'
import { json, withAuth, startOfDay, endOfDay, startOfWeek, startOfMonth, addMonths } from '@/lib/api'
import { num } from '@/lib/calc'

export async function GET() {
  return withAuth(async () => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekStart = startOfWeek(now)
    const monthStart = startOfMonth(now)
    const sixMonthsAgo = addMonths(now, -6)

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
    ] = await Promise.all([
      db.customer.count(),
      db.customer.count({ where: { status: { in: ['ACTIVE', 'APPROVED', 'DISBURSED'] } } }),
      db.customer.count({ where: { status: 'PENDING_VERIFICATION' } }),
      db.customer.count({ where: { status: 'APPROVED' } }),
      db.customer.count({ where: { status: 'REJECTED' } }),
      db.customer.count({ where: { status: 'DISBURSED' } }),
      db.group.count(),
      db.account.findMany({ select: { id: true, principal: true, totalPayable: true, status: true, startDate: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL' }, select: { amount: true, paymentMode: true, collectedById: true, collectionDate: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: todayStart, lte: todayEnd } }, include: { collectedBy: { select: { name: true } }, customer: { select: { fullName: true, customerId: true } }, account: { select: { accountNumber: true } } }, orderBy: { collectionDate: 'desc' } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: weekStart } }, select: { amount: true, paymentMode: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: monthStart } }, select: { amount: true, paymentMode: true } }),
      db.collection.findMany({ where: { status: 'SUCCESSFUL', collectionDate: { gte: sixMonthsAgo } }, select: { amount: true, collectionDate: true, paymentMode: true } }),
      db.customer.findMany({
        where: { status: 'PENDING_VERIFICATION' },
        include: {
          group: { select: { id: true, groupId: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
    const employees = await db.user.findMany({ select: { id: true, name: true, role: true } })
    const byEmployee = employees
      .map((e) => ({ name: e.name, role: e.role, amount: byEmployeeRaw[e.id] || 0 }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // overdue accounts: installments past due
    const overdueInstallments = await db.installment.findMany({
      where: { dueDate: { lt: now }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      include: { account: { include: { customer: { select: { fullName: true, customerId: true, primaryMobile: true } } } } },
    })
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
    const dueToday = await db.installment.findMany({
      where: { dueDate: { lte: todayEnd }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      select: { amount: true, paidAmount: true },
    })
    const todayDueAmount = dueToday.reduce((s, i) => s + (num(i.amount) - num(i.paidAmount)), 0)
    const todayPending = Math.max(todayDueAmount - todayCollectedAmount, 0)

    // projected collections for next 7 days (upcoming due installments)
    const sevenDaysLater = new Date(now)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const upcomingInstallments = await db.installment.findMany({
      where: {
        dueDate: { gt: todayEnd, lte: sevenDaysLater },
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      select: { amount: true, paidAmount: true, dueDate: true },
    })
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

    return json({
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
    })
  })
}
