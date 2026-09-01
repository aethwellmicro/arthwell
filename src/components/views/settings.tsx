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

  if (!canManage) {
    return <EmptyState message="Only Admin or Branch Manager can manage settings." icon={ShieldAlert} />
  }

  return (
    <div className="space-y-4">
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
                {fields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    {f.type === 'bool' ? (
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{f.label}</Label>
                        <Switch
                          checked={form[f.key] === 'true'}
                          onCheckedChange={(v) => setForm({ ...form, [f.key]: v ? 'true' : 'false' })}
                        />
                      </div>
                    ) : (
                      <>
                        <Label className="text-xs text-muted-foreground">{f.label}</Label>
                        <Input value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={loading} />
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={load}>Reset</Button>
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save Settings'}</Button>
      </div>

      <SectionCard title="System Information">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="System Version" value="LoanLedger v1.0.0" />
          <InfoRow label="Database" value="SQLite (local)" />
          <InfoRow label="Encryption" value="Password hashing: scrypt" />
          <InfoRow label="Session Timeout" value="7 days" />
          <InfoRow label="Backup Policy" value="Manual (Admin re-seed)" />
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
