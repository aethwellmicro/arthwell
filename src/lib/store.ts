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
}

export type ViewKey =
  | 'dashboard'
  | 'customers'
  | 'accounts'
  | 'collections'
  | 'receipts'
  | 'reports'
  | 'employees'
  | 'audit'
  | 'notifications'
  | 'settings'

interface AppState {
  user: SessionUser | null
  booted: boolean
  view: ViewKey
  selectedCustomerId: string | null
  selectedAccountId: string | null
  selectedCollectionId: string | null
  // collection dialog prefill
  collectionPrefill: { customerId?: string; accountId?: string } | null
  searchQuery: string
  setUser: (u: SessionUser | null) => void
  setBooted: (b: boolean) => void
  setView: (v: ViewKey) => void
  openCustomer: (id: string) => void
  openAccount: (id: string) => void
  openCollection: (id: string) => void
  startCollection: (customerId?: string, accountId?: string) => void
  clearPrefill: () => void
  setSearchQuery: (q: string) => void
  logout: () => void
}

export const useApp = create<AppState>((set) => ({
  user: null,
  booted: false,
  view: 'dashboard',
  selectedCustomerId: null,
  selectedAccountId: null,
  selectedCollectionId: null,
  collectionPrefill: null,
  searchQuery: '',
  setUser: (u) => set({ user: u }),
  setBooted: (b) => set({ booted: b }),
  setView: (v) => set({ view: v }),
  openCustomer: (id) => set({ view: 'customers', selectedCustomerId: id }),
  openAccount: (id) => set({ view: 'accounts', selectedAccountId: id }),
  openCollection: (id) => set({ view: 'receipts', selectedCollectionId: id }),
  startCollection: (customerId, accountId) =>
    set({ view: 'collections', collectionPrefill: { customerId, accountId } }),
  clearPrefill: () => set({ collectionPrefill: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  logout: () => set({ user: null, view: 'dashboard' }),
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
