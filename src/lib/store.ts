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

export interface DashboardCache {
  data: any | null
  activity: any[]
  lastFetched: number | null
}

interface AppState {
  user: SessionUser | null
  booted: boolean
  searchQuery: string
  dashboardCache: DashboardCache
  setUser: (u: SessionUser | null) => void
  setBooted: (b: boolean) => void
  setSearchQuery: (q: string) => void
  setDashboardCache: (data: any, activity?: any[]) => void
  invalidateDashboardCache: () => void
  logout: () => void
}

export const useApp = create<AppState>((set) => ({
  user: null,
  booted: false,
  searchQuery: '',
  dashboardCache: {
    data: null,
    activity: [],
    lastFetched: null,
  },
  setUser: (u) => set({ user: u }),
  setBooted: (b) => set({ booted: b }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setDashboardCache: (data, activity) =>
    set((state) => ({
      dashboardCache: {
        data,
        activity: activity !== undefined ? activity : state.dashboardCache.activity,
        lastFetched: Date.now(),
      },
    })),
  invalidateDashboardCache: () =>
    set({
      dashboardCache: { data: null, activity: [], lastFetched: null },
    }),
  logout: () =>
    set({
      user: null,
      dashboardCache: { data: null, activity: [], lastFetched: null },
    }),
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
