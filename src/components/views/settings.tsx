'use client'

import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Building2, Sliders, ShieldAlert, Database } from 'lucide-react'
import { apiFetch } from '@/lib/format'
import { useApp, canManageSettings } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SectionCard, EmptyState } from '@/components/ui-bits'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FIELDS = [
  { key: 'BRANCH_NAME', label: 'Branch Name', group: 'Branch', type: 'text' },
  { key: 'BRANCH_CODE', label: 'Branch Code', group: 'Branch', type: 'text' },
  { key: 'BRANCH_TIMEZONE', label: 'Branch Timezone', group: 'Branch', type: 'text' },
  { key: 'CUSTOMER_PREFIX', label: 'Customer ID Prefix', group: 'Codes', type: 'text' },
  { key: 'ACCOUNT_PREFIX', label: 'Account Number Prefix', group: 'Codes', type: 'text' },
  { key: 'RECEIPT_PREFIX', label: 'Receipt Number Prefix', group: 'Codes', type: 'text' },
  { key: 'CURRENCY', label: 'Currency', group: 'Codes', type: 'text' },
  { key: 'SMS_ENABLED', label: 'SMS Notifications Enabled', group: 'Notifications', type: 'bool' },
  { key: 'REVERSAL_APPROVAL', label: 'Require Manager Approval for Reversals', group: 'Security', type: 'bool' },
]

const GROUPS = ['Branch', 'Codes', 'Notifications', 'Security']

const GROUP_ICONS: Record<string, any> = {
  Branch: Building2,
  Codes: Sliders,
  Notifications: SettingsIcon,
  Security: ShieldAlert,
}

export function SettingsView() {
  const { user } = useApp()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canManage = canManageSettings(user?.role)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Record<string, string>>('/api/settings')
      setSettings(data)
      setForm({ ...data })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    setSaving(true)
    try {
      const changed: Record<string, string> = {}
      for (const f of FIELDS) {
        if (form[f.key] !== settings[f.key]) {
          changed[f.key] = form[f.key] ?? ''
        }
      }
      if (Object.keys(changed).length === 0) {
        toast.info('No changes to save.')
        return
      }
      const data = await apiFetch<Record<string, string>>('/api/settings', { method: 'PUT', body: JSON.stringify(changed) })
      setSettings(data)
      setForm({ ...data })
      toast.success('Settings saved')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Detect if there are unsaved changes
  const hasChanges = FIELDS.some((f) => form[f.key] !== settings[f.key])

  if (!canManage) {
    return <EmptyState message="Only Admin or Branch Manager can manage settings." icon={ShieldAlert} />
  }

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> You have unsaved changes.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={load}>Discard</Button>
            <Button size="sm" onClick={save} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving…' : 'Save Now'}</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {GROUPS.map((group) => {
          const Icon = GROUP_ICONS[group]
          const fields = FIELDS.filter((f) => f.group === group)
          return (
            <Card key={group}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {group}</CardTitle>
                <CardDescription>Configure {group.toLowerCase()} settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fields.map((f) => {
                  const changed = form[f.key] !== settings[f.key]
                  return (
                    <div key={f.key} className={cn('space-y-1.5 rounded-md p-2 -mx-2 transition-colors', changed && 'bg-amber-50 dark:bg-amber-950/20')}>
                      {f.type === 'bool' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">{f.label}</Label>
                            <p className="text-[10px] text-muted-foreground">{f.key === 'SMS_ENABLED' ? 'Send SMS notifications after collection' : 'Require manager approval before reversing transactions'}</p>
                          </div>
                          <Switch
                            checked={form[f.key] === 'true'}
                            onCheckedChange={(v) => setForm({ ...form, [f.key]: v ? 'true' : 'false' })}
                          />
                        </div>
                      ) : (
                        <>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            {f.label}
                            {changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Modified" />}
                          </Label>
                          <Input value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={loading} className={cn(changed && 'border-amber-400')} />
                        </>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-lg border bg-background/95 backdrop-blur shadow-lg p-3">
        <Button variant="outline" onClick={load} disabled={!hasChanges || saving}>Reset</Button>
        <Button onClick={save} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : hasChanges ? 'Save Changes' : 'No Changes'}
        </Button>
      </div>

      <SectionCard title="System Information">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="System Version" value="ArthWell Micro Finance v1.0.0" />
          <InfoRow label="Database" value="Supabase (PostgreSQL)" />
          <InfoRow label="Encryption" value="Password hashing: scrypt" />
          <InfoRow label="Session Timeout" value="7 days" />
          <InfoRow label="Backup Policy" value="Automatic (Supabase PITR)" />
          <InfoRow label="Currency" value={form.CURRENCY || 'INR'} />
        </div>
      </SectionCard>

    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
