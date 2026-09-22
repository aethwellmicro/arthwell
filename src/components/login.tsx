'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useApp } from '@/lib/store'
import { apiFetch } from '@/lib/format'
import { toast } from 'sonner'

const DEMO = [
  { email: 'admin@arthwell.local', password: 'Admin@2024!', role: 'Admin' },
]

export function LoginScreen() {
  const { setUser } = useApp()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await apiFetch<{ user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setUser(data.user)
      router.push('/dashboard')
      toast.success(`Welcome back, ${data.user.name}`)
    } catch (err: any) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function fill(d: (typeof DEMO)[number]) {
    setEmail(d.email)
    setPassword(d.password)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
        <div className="relative flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden">
            <img src="/arthwell-logo.png" alt="ArthWell" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">ArthWell Micro Finance</p>
            <p className="text-emerald-100 text-sm">Collection & Loan Management</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight">
            Internal portal for collections, accounts & reporting.
          </h1>
          <p className="mt-4 text-emerald-100/90">
            Manage customer accounts, disburse loans, record daily collections, generate
            receipts and audit-ready reports — all in one secure internal platform.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { k: 'Secure', v: 'Role-based access' },
              { k: 'Audited', v: 'Full activity trail' },
              { k: 'Reliable', v: 'Decimal-safe money' },
            ].map((f) => (
              <div key={f.k} className="rounded-lg bg-white/10 backdrop-blur p-3">
                <p className="font-semibold text-sm">{f.k}</p>
                <p className="text-xs text-emerald-100/80">{f.v}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-emerald-100/70">
          Authorized bank/office employees only. Customer-facing login is not available.
        </p>
      </div>

      {/* Right login form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-10 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border/60">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-wide">Employee Sign-in</span>
            </div>
            <CardTitle className="text-2xl">Sign in to your account</CardTitle>
            <CardDescription>Use your employee credentials to access the portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@cls.local"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Sign In
                  </span>
                )}
              </Button>
            </form>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Demo credentials — click to fill</p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => fill(d)}
                      className="text-left rounded-md bg-background border border-border px-2.5 py-1.5 hover:border-primary hover:bg-accent transition-colors"
                    >
                      <p className="text-xs font-medium">{d.role}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{d.email}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
