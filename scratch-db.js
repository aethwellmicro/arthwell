const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Users:", await prisma.user.count());
  console.log("Customers:", await prisma.customer.count());
  console.log("Accounts:", await prisma.account.count());
  console.log("Collections:", await prisma.collection.count());
  console.log("Receipts:", await prisma.receipt.count());
  console.log("AuditLogs:", await prisma.auditLog.count());
}

main().catch(console.error).finally(() => prisma.$disconnect());
