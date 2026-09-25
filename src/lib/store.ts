'use client'

import { create } from 'zustand'

export type Role = 'ADMIN' | 'BRANCH_MANAGER' | 'ACCOUNTANT' | 'COLLECTION_EMPLOYEE'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  employeeCode?: string | null
  phone?: string | null
  branchId?: string | null
  branch?: {
    id: string
    branchCode: string
    name: string
  } | null
}

interface AppState {
  user: SessionUser | null
  booted: boolean
  searchQuery: string
  setUser: (u: SessionUser | null) => void
  setBooted: (b: boolean) => void
  setSearchQuery: (q: string) => void
  logout: () => void
}

export const useApp = create<AppState>((set) => ({
  user: null,
  booted: false,
  searchQuery: '',
  setUser: (u) => set({ user: u }),
  setBooted: (b) => set({ booted: b }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  logout: () => set({ user: null }),
}))

export function canManageUsers(role?: Role) {
  return role === 'ADMIN' || role === 'BRANCH_MANAGER'
}
export function canReverse(role?: Role) {
  return role === 'ADMIN' || role === 'BRANCH_MANAGER' || role === 'ACCOUNTANT'
}
export function canManageSettings(role?: Role) {
  return role === 'ADMIN' || role === 'BRANCH_MANAGER'
}
