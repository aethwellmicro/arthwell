import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { json, error, parseBody } from '@/lib/api'

export async function POST(req: Request) {
  const secret = process.env.INITIAL_ADMIN_SETUP_SECRET
  if (!secret) return error('Bootstrap is not configured.', 403)

  const body = await parseBody(req)
  if (body.secret !== secret) return error('Invalid bootstrap secret.', 403)

  const email = (body.email || '').toString().trim().toLowerCase()
  const password = (body.password || '').toString()
  const name = (body.name || '').toString().trim()

  if (!email || !password || !name) {
    return error('Email, password, and name are required.', 422)
  }

  // Use a transaction or count to prevent race conditions
  const count = await db.user.count()
  if (count > 0) {
    return error('Application already bootstrapped.', 403)
  }

  // Create exactly one initial admin
  const user = await db.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      name,
      role: 'ADMIN',
      active: true,
      employeeCode: 'ADMIN-01'
    }
  })

  return json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  })
}
