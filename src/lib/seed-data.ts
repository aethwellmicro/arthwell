import { db } from './db'
import { hashPassword } from './auth'
import { calculateLoan } from './calc'

export async function main() {
  console.log('Seeding database...')

  // Clean
  await db.notification.deleteMany()
  await db.receipt.deleteMany()
  await db.collection.deleteMany()
  await db.installment.deleteMany()
  await db.account.deleteMany()
  await db.customer.deleteMany()
  await db.session.deleteMany()
  await db.auditLog.deleteMany()
  await db.systemSetting.deleteMany()
  await db.user.deleteMany()

  // Users
  const admin = await db.user.create({
    data: {
      email: 'admin@cls.local',
      name: 'Ramesh Kumar',
      passwordHash: hashPassword('admin123'),
      role: 'ADMIN',
      employeeCode: 'EMP-001',
      phone: '9876543210',
    },
  })
  const manager = await db.user.create({
    data: {
      email: 'manager@cls.local',
      name: 'Priya Sharma',
      passwordHash: hashPassword('manager123'),
      role: 'BRANCH_MANAGER',
      employeeCode: 'EMP-002',
      phone: '9876543211',
    },
  })
  const collector1 = await db.user.create({
    data: {
      email: 'collector@cls.local',
      name: 'Arun Verma',
      passwordHash: hashPassword('collector123'),
      role: 'COLLECTION_EMPLOYEE',
      employeeCode: 'EMP-003',
      phone: '9876543212',
    },
  })
  const collector2 = await db.user.create({
    data: {
      email: 'collector2@cls.local',
      name: 'Meena Nair',
      passwordHash: hashPassword('collector123'),
      role: 'COLLECTION_EMPLOYEE',
      employeeCode: 'EMP-004',
      phone: '9876543213',
    },
  })
  const accountant = await db.user.create({
    data: {
      email: 'accountant@cls.local',
      name: 'Suresh Pillai',
      passwordHash: hashPassword('account123'),
      role: 'ACCOUNTANT',
      employeeCode: 'EMP-005',
      phone: '9876543214',
    },
  })

  // Settings
  await db.systemSetting.createMany({
    data: [
      { key: 'BRANCH_NAME', value: 'Main Branch - MG Road' },
      { key: 'BRANCH_CODE', value: 'MBR-01' },
      { key: 'BRANCH_TIMEZONE', value: 'Asia/Kolkata' },
      { key: 'SMS_ENABLED', value: 'true' },
      { key: 'REVERSAL_APPROVAL', value: 'false' },
      { key: 'CUSTOMER_PREFIX', value: 'CUST' },
      { key: 'ACCOUNT_PREFIX', value: 'LN' },
      { key: 'RECEIPT_PREFIX', value: 'RCP' },
      { key: 'CURRENCY', value: 'INR' },
    ],
  })

  // Customers
  const custData = [
    { name: 'Lakshmi Iyer', mobile: '9000010001', city: 'Bengaluru', area: 'Indiranagar', occupation: 'Tailor', ref: 'Auto Stand' },
    { name: 'Karthik Reddy', mobile: '9000010002', city: 'Bengaluru', area: 'Whitefield', occupation: 'Electrician', ref: 'Sharma Stores' },
    { name: 'Fatima Sheikh', mobile: '9000010003', city: 'Bengaluru', area: 'Frazer Town', occupation: 'Boutique Owner', ref: 'Community Centre' },
    { name: 'Joseph Dsouza', mobile: '9000010004', city: 'Bengaluru', area: 'Jayanagar', occupation: 'Plumber', ref: 'Parish' },
    { name: 'Anjali Gupta', mobile: '9000010005', city: 'Bengaluru', area: 'Koramangala', occupation: 'Tiffin Service', ref: 'Apartment Sec' },
    { name: 'Mohan Rao', mobile: '9000010006', city: 'Bengaluru', area: 'Malleshwaram', occupation: 'Florist', ref: 'Temple' },
    { name: 'Zara Khan', mobile: '9000010007', city: 'Bengaluru', area: 'BTM Layout', occupation: 'Beautician', ref: 'Salon' },
    { name: 'Pradeep Nair', mobile: '9000010008', city: 'Bengaluru', area: 'HSR Layout', occupation: 'Mechanic', ref: 'Garage' },
    { name: 'Savithri Devi', mobile: '9000010009', city: 'Bengaluru', area: 'Rajajinagar', occupation: 'Vegetable Vendor', ref: 'Market' },
    { name: 'Imran Pasha', mobile: '9000010010', city: 'Bengaluru', area: 'Shivajinagar', occupation: 'Carpenter', ref: 'Workshop' },
  ]

  const customers = []
  for (let i = 0; i < custData.length; i++) {
    const c = custData[i]
    const createdById = i % 2 === 0 ? collector1.id : collector2.id
    const cust = await db.customer.create({
      data: {
        customerId: `CUST-${String(i + 1).padStart(4, '0')}`,
        fullName: c.name,
        primaryMobile: c.mobile,
        alternateMobile: '',
        address: `${c.area}, ${c.city}`,
        city: c.city,
        area: c.area,
        occupation: c.occupation,
        referenceName: c.ref,
        referenceMobile: '9900000000',
        idType: 'Aadhaar',
        idNumber: `XXXX-XXXX-${1000 + i}`,
        status: 'ACTIVE',
        createdById,
      },
    })
    customers.push(cust)
  }

  // Accounts/Loans
  const loanConfigs = [
    { principal: 50000, rate: 12, type: 'FLAT' as const, period: 'YEARLY' as const, tenure: 10, freq: 'MONTHLY' as const, daysAgo: 60 },
    { principal: 30000, rate: 5, type: 'FLAT' as const, period: 'FLAT_PERIOD' as const, tenure: 20, freq: 'WEEKLY' as const, daysAgo: 45 },
    { principal: 100000, rate: 14, type: 'REDUCING' as const, period: 'YEARLY' as const, tenure: 12, freq: 'MONTHLY' as const, daysAgo: 90 },
    { principal: 25000, rate: 4, type: 'FLAT' as const, period: 'FLAT_PERIOD' as const, tenure: 30, freq: 'WEEKLY' as const, daysAgo: 30 },
    { principal: 75000, rate: 12, type: 'FLAT' as const, period: 'YEARLY' as const, tenure: 15, freq: 'MONTHLY' as const, daysAgo: 75 },
    { principal: 40000, rate: 14, type: 'REDUCING' as const, period: 'YEARLY' as const, tenure: 8, freq: 'MONTHLY' as const, daysAgo: 50 },
    { principal: 60000, rate: 5, type: 'FLAT' as const, period: 'FLAT_PERIOD' as const, tenure: 25, freq: 'WEEKLY' as const, daysAgo: 20 },
    { principal: 20000, rate: 12, type: 'FLAT' as const, period: 'YEARLY' as const, tenure: 6, freq: 'MONTHLY' as const, daysAgo: 120 },
  ]

  const accounts = []
  for (let i = 0; i < loanConfigs.length; i++) {
    const cfg = loanConfigs[i]
    const customer = customers[i % customers.length]
    const collector = i % 2 === 0 ? collector1 : collector2
    const startDate = new Date(Date.now() - cfg.daysAgo * 24 * 60 * 60 * 1000)
    const computed = calculateLoan({
      principal: cfg.principal,
      interestRate: cfg.rate,
      interestType: cfg.type,
      interestPeriod: cfg.period,
      tenure: cfg.tenure,
      installmentFreq: cfg.freq,
      startDate,
    })

    const account = await db.account.create({
      data: {
        accountNumber: `LN-${String(i + 1).padStart(4, '0')}`,
        customerId: customer.id,
        principal: computed.principal,
        interestRate: cfg.rate,
        interestType: cfg.type,
        interestPeriod: cfg.period,
        tenure: cfg.tenure,
        installmentFreq: cfg.freq,
        installmentAmount: computed.installmentAmount,
        totalPayable: computed.totalPayable,
        totalInterest: computed.totalInterest,
        startDate,
        firstDueDate: computed.firstDueDate,
        maturityDate: computed.maturityDate,
        status: 'ACTIVE',
        remarks: 'Initial loan',
        createdById: collector.id,
      },
    })

    // installments
    for (const s of computed.schedule) {
      await db.installment.create({
        data: {
          accountId: account.id,
          installNo: s.installNo,
          dueDate: s.dueDate,
          amount: s.amount,
          status: 'PENDING',
        },
      })
    }
    accounts.push({ account, computed, collector })
  }

  // Collections: simulate some payments
  let receiptCounter = 1
  for (const { account, computed, collector } of accounts) {
    const numInstallmentsPaid = Math.floor(Math.random() * 4) + 1
    let paid = 0
    const totalPayable = Number(computed.totalPayable)
    for (let p = 0; p < numInstallmentsPaid; p++) {
      const amt = Number(computed.installmentAmount)
      if (paid + amt > totalPayable) break
      const prevOutstanding = totalPayable - paid
      const currOutstanding = prevOutstanding - amt
      const daysAgo = Math.max(1, (numInstallmentsPaid - p) * 5)
      const collectionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      const receiptNumber = `RCP-${String(receiptCounter++).padStart(5, '0')}`
      const paymentMode = (['CASH', 'UPI', 'BANK'] as const)[p % 3]
      const col = await db.collection.create({
        data: {
          receiptNumber,
          customerId: account.customerId,
          accountId: account.id,
          collectionDate,
          amount: amt,
          paymentMode,
          collectedById: collector.id,
          previousOutstanding: prevOutstanding,
          currentOutstanding: currOutstanding,
          remarks: 'Installment payment',
          status: 'SUCCESSFUL',
        },
      })
      await db.receipt.create({
        data: {
          collectionId: col.id,
          receiptNumber,
          branchName: 'Main Branch - MG Road',
          printCount: 0,
        },
      })
      await db.notification.create({
        data: {
          collectionId: col.id,
          customerId: account.customerId,
          type: 'PAYMENT_CONFIRMATION',
          message: `Dear Customer, we have received ${amt} against your loan. Outstanding: ${currOutstanding}. Thank you.`,
          recipient: '9000000000',
          status: 'SENT',
          userId: collector.id,
        },
      })
      paid += amt
    }
  }

  // Audit log
  await db.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'CREATE', entity: 'USER', entityId: collector1.id, newValue: 'Collection employee created' },
      { userId: admin.id, action: 'CREATE', entity: 'CUSTOMER', entityId: customers[0].id, newValue: customers[0].fullName },
      { userId: collector1.id, action: 'CREATE', entity: 'ACCOUNT', entityId: accounts[0].account.id, newValue: accounts[0].account.accountNumber },
      { userId: collector1.id, action: 'CREATE', entity: 'COLLECTION', entityId: '', newValue: 'Daily collection entry' },
      { userId: admin.id, action: 'LOGIN', entity: 'USER', entityId: admin.id },
    ],
  })

  console.log('Seed complete.')
  console.log('Login accounts:')
  console.log('  admin@cls.local / admin123      (ADMIN)')
  console.log('  manager@cls.local / manager123  (BRANCH_MANAGER)')
  console.log('  collector@cls.local / collector123 (COLLECTION_EMPLOYEE)')
  console.log('  accountant@cls.local / account123 (ACCOUNTANT)')
}

