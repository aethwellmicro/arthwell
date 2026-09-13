import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function runTests() {
  let passed = true
  
  // 1. Authentication Check (mock)
  const users = await prisma.user.findMany()
  if (users.length !== 7) {
    console.error("Auth test failed: expected 7 users")
    passed = false
  }

  // 2. Customer Workflow
  const newCustomer = await prisma.customer.create({
    data: {
      fullName: "Test Customer Phase 9I",
      primaryMobile: "+91-9999999999",
      address: "123 Test St",
      customerId: "CUST-9I-TEST",
      createdById: users[0].id
    }
  })
  
  const fetchedCustomer = await prisma.customer.findUnique({
    where: { id: newCustomer.id }
  })
  
  if (!fetchedCustomer || fetchedCustomer.fullName !== "Test Customer Phase 9I") {
    console.error("Customer workflow failed")
    passed = false
  }

  // 3. Financial calculations
  const accounts = await prisma.account.findMany()
  const totalPrincipal = accounts.reduce((acc, a) => acc + a.principal.toNumber(), 0)
  if (totalPrincipal !== 473243) {
    console.error(`Account principal mismatch: ${totalPrincipal}`)
    passed = false
  }
  
  const collections = await prisma.collection.findMany()
  const totalCollections = collections.reduce((acc, c) => acc + c.amount.toNumber(), 0)
  if (totalCollections !== 146740.57) {
    console.error(`Collection amount mismatch: ${totalCollections}`)
    passed = false
  }

  // 4. Date validation
  const sampleInstallment = await prisma.installment.findFirst({
    where: { status: 'PENDING' }
  })
  
  if (sampleInstallment && isNaN(sampleInstallment.dueDate.getTime())) {
    console.error("Date validation failed")
    passed = false
  }

  // Check system settings
  const settings = await prisma.systemSetting.findMany()
  if (settings.length !== 9) {
    console.error("System settings count mismatch")
    passed = false
  }

  // Cleanup test data
  await prisma.customer.delete({ where: { id: newCustomer.id } })

  console.log(passed ? "SUCCESS" : "FAILED")
}

runTests().finally(() => prisma.$disconnect())
