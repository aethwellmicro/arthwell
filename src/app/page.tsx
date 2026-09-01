'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/store'
import { apiFetch } from '@/lib/format'
import { LoginScreen } from '@/components/login'
import { AppShell } from '@/components/app-shell'

export default function Home() {
  const { user, booted, setUser, setBooted, logout } = useApp()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<{ user: any }>('/api/auth/me')
        if (!cancelled) setUser(data.user)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setBooted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setUser, setBooted])

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  return <AppShell />
}
