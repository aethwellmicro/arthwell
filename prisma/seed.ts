import { main } from '@/lib/seed-data'

// CLI entry: run with `bun run prisma/seed.ts`
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    const { db } = await import('../src/lib/db')
    await db.$disconnect()
  })
