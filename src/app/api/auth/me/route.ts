import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { json, error } from '@/lib/api'

export async function GET() {
  const user = await getSession()
  if (!user) return error('Not authenticated', 401)
  return json({ user })
}
