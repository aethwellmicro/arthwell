import { PrismaClient } from '@prisma/client'
// @ts-ignore
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'custom.db')

async function main() {
  console.log('Starting migration rehearsal preparation script...')
  
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite database not found at ${DB_PATH}`)
  }
  if (!process.env.PG_DATABASE_URL) {
    throw new Error('PG_DATABASE_URL environment variable is missing')
  }

  // Connect to both databases
  const sqlite = new Database(DB_PATH, { readonly: true })
  const prismaPg = new PrismaClient({
    datasourceUrl: process.env.PG_DATABASE_URL,
  })

  // Migration Order mapping - parents before children
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

  for (const table of tables) {
    console.log(`\nMigrating table: ${table}...`)
    
    // Read from SQLite
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
    console.log(`Found ${rows.length} records in SQLite.`)

    let successCount = 0
    let errorCount = 0

    // Upsert to PostgreSQL
    for (const row of rows as any[]) {
      try {
        // Convert any SQLite 1/0 booleans to true/false, and unix timestamp to Date
        const data = { ...row }
        
        if (table === 'User' && 'active' in data) {
          data.active = data.active === 1
        }
        
        // Convert dates that are stored as unix epoch back to Date objects if needed, 
        // though SQLite usually stores as ISO strings. We'll pass them as-is if they are ISO.
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number' && (key.endsWith('At') || key.endsWith('Date'))) {
             data[key] = new Date(value)
          }
        }

        // Upsert by ID to ensure idempotency and preservation of existing primary keys
        await (prismaPg[table.charAt(0).toLowerCase() + table.slice(1)] as any).upsert({
          where: { id: row.id },
          create: data,
          update: data,
        })
        successCount++
      } catch (error) {
        console.error(`Failed to migrate ${table} ID ${row.id}:`, error)
        errorCount++
      }
    }

    console.log(`Completed ${table}: ${successCount} successful, ${errorCount} failed.`)
  }

  console.log('\nMigration complete.')
  sqlite.close()
  await prismaPg.$disconnect()
}

main().catch(console.error)
