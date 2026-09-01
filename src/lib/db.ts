import { PrismaClient } from '@prisma/client'

// Always clear the global cache in development to avoid stale schema issues
// after migrations
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (globalForPrisma.prisma) {
  try {
    globalForPrisma.prisma.$disconnect()
  } catch {}
  globalForPrisma.prisma = undefined
}

export const db = new PrismaClient({
  log: ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
