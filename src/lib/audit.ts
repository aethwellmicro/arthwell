import { db } from './db'
import type { SessionUser } from './auth'

export async function logAudit(params: {
  user: SessionUser | null
  action: string
  entity: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.user?.id ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue ? safeStringify(params.oldValue) : null,
        newValue: params.newValue ? safeStringify(params.newValue) : null,
        reason: params.reason ?? null,
      },
    })
  } catch (e) {
    console.error('audit log failed', e)
  }
}

function safeStringify(v: unknown): string {
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
