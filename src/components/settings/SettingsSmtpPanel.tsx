'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Send, Server } from 'lucide-react';
import { useStore } from '@/lib/store';
import { canAccessModuleView } from '@/lib/rbac';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useSmtpSettings } from '@/hooks/useSmtpSettings';
import type { AgencySmtpSettings } from '@/lib/api/smtp-settings-cache';
import { crmToastError, crmToastSuccess } from '@/lib/crm-toast-bus';

const DEFAULT_FORM = {
  enabled: false,
  host: '',
  port: '587',
  use_tls: true,
  use_ssl: false,
  username: '',
  password: '',
  from_email: '',
  from_name: '',
};

function settingsToForm(settings: AgencySmtpSettings) {
  const port = settings.port || 587;
  let use_tls = settings.use_tls;
  let use_ssl = settings.use_ssl;

  if (use_ssl && port === 587) {
    use_ssl = false;
    use_tls = true;
  } else if (use_tls && port === 465) {
    use_tls = false;
    use_ssl = true;
  }

  return {
    enabled: settings.enabled,
    host: settings.host,
    port: String(port),
    use_tls,
    use_ssl,
    username: settings.username,
    password: '',
    from_email: settings.from_email,
    from_name: settings.from_name,
  };
}

function applySecurityMode(
  form: typeof DEFAULT_FORM,
  mode: 'starttls' | 'ssl',
): typeof DEFAULT_FORM {
  if (mode === 'ssl') {
    return { ...form, port: '465', use_ssl: true, use_tls: false };
  }
  return { ...form, port: '587', use_tls: true, use_ssl: false };
}

export function SettingsSmtpPanel() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);
  const roleDefinitions = useStore((s) => s.roleDefinitions);

  const { settings, loading, error: loadError, save, sendTest, testEmailDefault } =
    useSmtpSettings();

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [testEmail, setTestEmail] = useState('');

  const canView = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'workspace_settings', roleDefinitions)
  );

  useEffect(() => {
    if (!settings) return;
    setForm(settingsToForm(settings));
    setPasswordConfigured(settings.password_configured);
    setTestEmail((prev) => prev || testEmailDefault);
  }, [settings, testEmailDefault]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'port') {
        const portNum = Math.round(Number(value)) || 587;
        if (portNum === 465) return applySecurityMode(next, 'ssl');
        if (portNum === 587) return applySecurityMode(next, 'starttls');
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const port = Math.min(65535, Math.max(1, Math.round(Number(form.port)) || 587));
      const payload = {
        enabled: form.enabled,
        host: form.host.trim(),
        port,
        use_tls: form.use_ssl ? false : form.use_tls,
        use_ssl: form.use_ssl,
        username: form.username.trim(),
        from_email: form.from_email.trim(),
        from_name: form.from_name.trim(),
        ...(form.password.trim() ? { password: form.password } : {}),
      };
      const saved = await save(payload);
      setForm(settingsToForm(saved));
      setPasswordConfigured(saved.password_configured);
      crmToastSuccess('SMTP settings saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save SMTP settings';
      setError(message);
      crmToastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const result = await sendTest(testEmail.trim() || undefined);
      crmToastSuccess(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test email failed';
      setError(message);
      crmToastError(message);
    } finally {
      setTesting(false);
    }
  };

  if (currentUser && !canView) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-xs shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-foreground">SMTP setup</h2>
        <p className="text-muted-foreground leading-relaxed">
          Your role does not include access to workspace settings.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (loading && !settings) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-[11px] text-muted-foreground animate-pulse">
        Loading SMTP settings…
      </div>
    );
  }

  const displayError = error || loadError;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {displayError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {displayError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 shrink-0">
              <Server className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-foreground">Outbound SMTP</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Configure how this workspace sends email — lead alerts, invoices, and notifications.
              </p>
            </div>
            <label className="flex items-center gap-2 shrink-0 text-[11px] font-semibold text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                checked={form.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="lg:col-span-2 2xl:col-span-3">
              <label htmlFor="smtp-host" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                SMTP host
              </label>
              <input
                id="smtp-host"
                type="text"
                value={form.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="smtp.example.com"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="smtp-port" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Port
              </label>
              <input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => update('port', e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
                <input
                  type="radio"
                  name="smtp-security"
                  className="h-4 w-4 border-border accent-primary"
                  checked={form.use_tls && !form.use_ssl}
                  onChange={() => setForm((prev) => applySecurityMode(prev, 'starttls'))}
                />
                <span className="font-medium text-foreground">Use STARTTLS (port 587)</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
                <input
                  type="radio"
                  name="smtp-security"
                  className="h-4 w-4 border-border accent-primary"
                  checked={form.use_ssl}
                  onChange={() => setForm((prev) => applySecurityMode(prev, 'ssl'))}
                />
                <span className="font-medium text-foreground">Use SSL (port 465)</span>
              </label>
              <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
                Gmail: use STARTTLS on port 587 with an app password.
              </p>
            </div>

            <div>
              <label htmlFor="smtp-username" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Username
              </label>
              <input
                id="smtp-username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="smtp-password" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Password
              </label>
              <PasswordInput
                id="smtp-password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder={passwordConfigured ? 'Leave blank to keep current password' : 'Enter SMTP password'}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Sender identity</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Shown as the From address on outbound CRM emails.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="smtp-from-email" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                From email
              </label>
              <input
                id="smtp-from-email"
                type="email"
                value={form.from_email}
                onChange={(e) => update('from_email', e.target.value)}
                placeholder="noreply@youragency.com"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="smtp-from-name" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                From name
              </label>
              <input
                id="smtp-from-name"
                type="text"
                value={form.from_name}
                onChange={(e) => update('from_name', e.target.value)}
                placeholder={currentAgency.name}
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save SMTP settings'}
          </button>

          <div className="flex flex-1 min-w-[220px] flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="smtp-test-email" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Test recipient
              </label>
              <input
                id="smtp-test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="button"
              disabled={testing || !form.enabled}
              onClick={() => void handleTest()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold hover:bg-secondary disabled:opacity-60"
            >
              <Send className="h-4 w-4 shrink-0" />
              {testing ? 'Sending…' : 'Send test email'}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
