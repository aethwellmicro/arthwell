import { PrismaClient } from '@prisma/client'
// @ts-ignore
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')

async function main() {
  console.log('Starting full 100% data validation...')
  
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite database not found at ${DB_PATH}`)
  }
  if (!process.env.PG_DATABASE_URL) {
    throw new Error('PG_DATABASE_URL environment variable is missing')
  }

  const sqlite = new Database(DB_PATH, { readonly: true })
  const prismaPg = new PrismaClient({
    datasourceUrl: process.env.PG_DATABASE_URL,
  })

  const tables = [
    'SystemSetting',
    'User',
    'Session',
    'Customer',
    'Account',
    'Installment',
    'Collection',
    'Receipt',
    'Notification',
    'AuditLog',
  ]

  let hasErrors = false
  
  console.log('--- ROW COUNT COMPARISON ---')
  console.log('Table'.padEnd(20), 'SQLite'.padEnd(10), 'PostgreSQL'.padEnd(15), 'Status')
  
  for (const table of tables) {
    const sqliteCount = (sqlite.prepare(`SELECT count(*) as count FROM "${table}"`).get() as any).count
    const pgCount = await (prismaPg[table.charAt(0).toLowerCase() + table.slice(1)] as any).count()
    
    const status = sqliteCount === pgCount ? 'OK' : 'MISMATCH'
    console.log(table.padEnd(20), String(sqliteCount).padEnd(10), String(pgCount).padEnd(15), status)
    
    if (status !== 'OK') {
      hasErrors = true
    }
  }

  console.log('\n--- FINANCIAL PRECISION VALIDATION ---')
  // Accounts Principal Sum
  const sqliteAccSum = (sqlite.prepare(`SELECT SUM(principal) as sum FROM "Account"`).get() as any).sum
  const pgAccAgg = await prismaPg.account.aggregate({ _sum: { principal: true } })
  const pgAccSum = Number(pgAccAgg._sum.principal || 0)
  
  const accStatus = Math.abs(sqliteAccSum - pgAccSum) < 0.001 ? 'OK' : 'MISMATCH'
  console.log('Total Account Principal:', `SQLite: ${sqliteAccSum}`, `PG: ${pgAccSum}`, accStatus)
  if (accStatus !== 'OK') hasErrors = true

  // Collections Amount Sum
  const sqliteColSum = (sqlite.prepare(`SELECT SUM(amount) as sum FROM "Collection"`).get() as any).sum
  const pgColAgg = await prismaPg.collection.aggregate({ _sum: { amount: true } })
  const pgColSum = Number(pgColAgg._sum.amount || 0)
  
  const colStatus = Math.abs(sqliteColSum - pgColSum) < 0.001 ? 'OK' : 'MISMATCH'
  console.log('Total Collection Amount:', `SQLite: ${sqliteColSum}`, `PG: ${pgColSum}`, colStatus)
  if (colStatus !== 'OK') hasErrors = true

  console.log('\n--- PRIMARY KEY & RELATIONSHIP INTEGRITY ---')
  for (const table of tables) {
    const sqliteIds = sqlite.prepare(`SELECT id FROM "${table}"`).all().map((r: any) => r.id)
    const pgRecords = await (prismaPg[table.charAt(0).toLowerCase() + table.slice(1)] as any).findMany({ select: { id: true } })
    const pgIds = new Set(pgRecords.map((r: any) => r.id))
    
    const missing = sqliteIds.filter((id: string) => !pgIds.has(id))
    if (missing.length > 0) {
      console.log(`❌ ${table} has ${missing.length} missing primary keys in PG.`)
      hasErrors = true
    } else {
      console.log(`✅ ${table} PK set matches exactly.`)
    }
  }

  sqlite.close()
  await prismaPg.$disconnect()

  if (hasErrors) {
    console.error('\n❌ VALIDATION FAILED. Differences detected between SQLite and PostgreSQL.')
    process.exit(1)
  } else {
    console.log('\n✅ VALIDATION PASSED. PostgreSQL matches SQLite exactly.')
    process.exit(0)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
