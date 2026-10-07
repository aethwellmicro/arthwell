import { db } from './db'
import type { SessionUser } from './auth'
import { ROLE_ADMIN } from './auth'

/**
 * Ensures a default Main Branch exists in the database and links unassigned records.
 */
export async function ensureDefaultBranch() {
  let mainBranch = await db.branch.findFirst({
    where: { name: 'Main Branch' },
  })

  if (!mainBranch) {
    mainBranch = await db.branch.create({
      data: {
        branchCode: 'BR-0001',
        name: 'Main Branch',
        city: 'Pune',
        state: 'Maharashtra',
        status: 'ACTIVE',
      },
    })
  }

  return mainBranch
}

/**
 * Returns the effective branch filter for a given user and optional requested branchId.
 * - ADMIN:
 *   - If requestedBranchId === 'ALL' or empty -> returns {} (all branches)
 *   - If requestedBranchId is provided -> returns { branchId: requestedBranchId }
 * - Non-ADMIN (BRANCH_MANAGER, ACCOUNTANT, COLLECTION_EMPLOYEE):
 *   - Always restricted strictly to user.branchId.
 */
export function getBranchFilter(
  user: SessionUser,
  requestedBranchId?: string | null,
  relationPath: string = 'branchId'
): Record<string, any> {
  const isAdmin = user.role === ROLE_ADMIN

  if (isAdmin) {
    if (!requestedBranchId || requestedBranchId === 'ALL') {
      return {}
    }
    return { [relationPath]: requestedBranchId }
  }

  // Non-admin is strictly bounded to their assigned branch
  if (user.branchId) {
    return { [relationPath]: user.branchId }
  }

  return { [relationPath]: '__UNASSIGNED__' }
}

/**
 * Validates whether a user is allowed to perform operations on a specific branchId.
 */
export function assertBranchAccess(user: SessionUser, targetBranchId?: string | null): boolean {
  if (user.role === ROLE_ADMIN) return true
  return Boolean(targetBranchId && user.branchId && user.branchId === targetBranchId)
}
