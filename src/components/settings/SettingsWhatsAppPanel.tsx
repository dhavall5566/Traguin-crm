'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, MessageCircle, Send, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { canAccessModuleView } from '@/lib/rbac';
import { useWhatsAppTemplateSettings } from '@/hooks/useWhatsAppTemplateSettings';
import type { AgencyWhatsAppTemplateSettings } from '@/lib/api/whatsapp-template-settings-cache';
import {
  sendWhatsAppTemplateTest,
  type WhatsAppTemplateCatalogEntry,
} from '@/lib/api/whatsapp-template-settings';
import { crmToastError, crmToastSuccess } from '@/lib/crm-toast-bus';

type FormState = {
  default_template_id: string;
  default_template_name: string;
  template_language: string;
  overrides: Record<string, string>;
};

const EMPTY_FORM: FormState = {
  default_template_id: '',
  default_template_name: '',
  template_language: 'en',
  overrides: {},
};

function settingsToForm(settings: AgencyWhatsAppTemplateSettings): FormState {
  return {
    default_template_id: settings.default_template_id,
    default_template_name: settings.default_template_name,
    template_language: settings.template_language || 'en',
    overrides: { ...settings.overrides },
  };
}

function audienceLabel(audience: string): string {
  if (audience === 'customer') return 'Customer';
  if (audience === 'team') return 'Team';
  return 'Other';
}

function previewTemplateText(text: string | undefined, maxLength = 72): string {
  if (!text?.trim()) return '—';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
}

export function SettingsWhatsAppPanel() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);
  const roleDefinitions = useStore((s) => s.roleDefinitions);

  const { settings, catalog, loading, error: loadError, save } = useWhatsAppTemplateSettings();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [testPhone, setTestPhone] = useState('');
  const [testingCatalogId, setTestingCatalogId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<WhatsAppTemplateCatalogEntry | null>(null);

  const canView = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'workspace_settings', roleDefinitions)
  );

  useEffect(() => {
    if (!settings) return;
    setForm(settingsToForm(settings));
  }, [settings]);

  useEffect(() => {
    if (testPhone.trim()) return;
    if (currentUser?.phone) {
      setTestPhone(currentUser.phone);
    }
  }, [currentUser?.phone, testPhone]);

  const catalogRows = useMemo(() => {
    if (!catalog) return [];
    return [...catalog].sort((a, b) => {
      if (a.audience !== b.audience) return a.audience.localeCompare(b.audience);
      return a.subject.localeCompare(b.subject);
    });
  }, [catalog]);

  const updateOverride = (catalogId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [catalogId]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const overrides = Object.fromEntries(
        Object.entries(form.overrides)
          .map(([key, value]) => [key, value.trim()] as const)
          .filter(([, value]) => value.length > 0),
      );
      const saved = await save({
        default_template_id: form.default_template_id.trim(),
        default_template_name: form.default_template_name.trim(),
        template_language: form.template_language.trim() || 'en',
        overrides,
      });
      setForm(settingsToForm(saved));
      crmToastSuccess('WhatsApp template settings saved');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save WhatsApp template settings';
      setError(message);
      crmToastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTemplate = async (catalogId: string) => {
    setTestingCatalogId(catalogId);
    setError(null);
    try {
      const override = (form.overrides[catalogId] ?? '').trim();
      const result = await sendWhatsAppTemplateTest({
        catalog_id: catalogId,
        to_phone: testPhone.trim() || undefined,
        template_override: override || undefined,
      });
      crmToastSuccess(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test WhatsApp failed';
      setError(message);
      crmToastError(message);
    } finally {
      setTestingCatalogId(null);
    }
  };

  if (currentUser && !canView) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-xs shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-foreground">WhatsApp templates</h2>
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
        Loading WhatsApp template settings…
      </div>
    );
  }

  const displayError = error || loadError;
  const envFallbackId = settings?.env_default_template_id || '';
  const envFallbackName = settings?.env_default_template_name || '';
  const senderPhone = settings?.sender_display_phone || '+91 95372 14580';

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {displayError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {displayError}
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-foreground leading-relaxed">
        <strong>Where to look:</strong> Test messages are sent from{' '}
        <strong>Traguin ({senderPhone})</strong>. Open that chat in WhatsApp — not your personal
        SMS inbox. For new enquiry auto-replies, test the{' '}
        <strong>customer_inquiry_received</strong> row (template <strong>409886</strong>), not the RM
        welcome row (<strong>409874</strong>).
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500 shrink-0">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Default WhatsApp template</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Used for CRM utility alerts and any notification without a per-template override.
              Enter a WhatsMarketing numeric template ID and/or a Meta-approved template name.
            </p>
            {(envFallbackId || envFallbackName) && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Server fallback when fields are empty:{' '}
                {envFallbackId ? `ID ${envFallbackId}` : null}
                {envFallbackId && envFallbackName ? ' · ' : null}
                {envFallbackName ? `name ${envFallbackName}` : null}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              htmlFor="wa-default-template-id"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Template ID (WhatsMarketing)
            </label>
            <input
              id="wa-default-template-id"
              type="text"
              value={form.default_template_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, default_template_id: e.target.value }))
              }
              placeholder="e.g. 123456789"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="wa-default-template-name"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Template name (Meta)
            </label>
            <input
              id="wa-default-template-name"
              type="text"
              value={form.default_template_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, default_template_name: e.target.value }))
              }
              placeholder="e.g. traguin_crm_alert"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="wa-template-language"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Language code
            </label>
            <input
              id="wa-template-language"
              type="text"
              value={form.template_language}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, template_language: e.target.value }))
              }
              placeholder="en"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Per-notification overrides</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Optional template ID or Meta name for each CRM notification. Leave blank to use the
              default above. Numeric values are sent as template ID; text values as template name.
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <label
              htmlFor="wa-test-phone"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Test recipient phone
            </label>
            <input
              id="wa-test-phone"
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Audience</th>
                <th className="px-3 py-2 font-semibold">Notification</th>
                <th className="px-3 py-2 font-semibold">Catalog ID</th>
                <th className="px-3 py-2 font-semibold min-w-[200px]">Template text</th>
                <th className="px-3 py-2 font-semibold">WhatsApp</th>
                <th className="px-3 py-2 font-semibold min-w-[220px]">Template ID / name</th>
                <th className="px-3 py-2 font-semibold w-[88px]">Test</th>
              </tr>
            </thead>
            <tbody>
              {catalogRows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-border/70 ${
                    row.id === 'customer_inquiry_received' ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{audienceLabel(row.audience)}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.subject}
                    {row.id === 'customer_inquiry_received' ? (
                      <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                        Inquiry auto-reply
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{row.id}</td>
                  <td className="px-3 py-2">
                    {row.whatsapp_text?.trim() ? (
                      <button
                        type="button"
                        onClick={() => setPreviewRow(row)}
                        className="group flex max-w-[280px] items-start gap-1.5 text-left text-[10px] text-muted-foreground hover:text-foreground"
                        title="View full template"
                      >
                        <Eye className="mt-0.5 h-3 w-3 shrink-0 text-primary opacity-70 group-hover:opacity-100" />
                        <span className="line-clamp-2 leading-relaxed">
                          {previewTemplateText(row.whatsapp_text)}
                        </span>
                      </button>
                    ) : (
                      <span className="text-muted-foreground">Email only</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.whatsapp_enabled ? (
                      <span className="text-emerald-600">Enabled</span>
                    ) : (
                      <span className="text-muted-foreground">Email only</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={form.overrides[row.id] ?? ''}
                      onChange={(e) => updateOverride(row.id, e.target.value)}
                      placeholder={
                        row.whatsapp_enabled
                          ? row.default_template_id
                            ? `Default: ${row.default_template_id}`
                            : 'Override (optional)'
                          : 'N/A'
                      }
                      disabled={!row.whatsapp_enabled}
                      className="w-full rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-[11px] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={!row.whatsapp_enabled || testingCatalogId === row.id}
                      onClick={() => void handleTestTemplate(row.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-[10px] font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                      title="Send trial WhatsApp with sample data"
                    >
                      <Send className="h-3 w-3" />
                      {testingCatalogId === row.id ? 'Sending…' : 'Test'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previewRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewRow(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-template-preview-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <h3 id="wa-template-preview-title" className="text-sm font-bold text-foreground">
                  WhatsApp template preview
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">{previewRow.subject}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{previewRow.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded-md p-1 hover:bg-secondary"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-foreground">
                {previewRow.whatsapp_text}
              </pre>
            </div>

            {(previewRow.default_template_id || previewRow.default_template_name) && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                Default Meta/WhatsMarketing mapping:{' '}
                {previewRow.default_template_id ? `ID ${previewRow.default_template_id}` : null}
                {previewRow.default_template_id && previewRow.default_template_name ? ' · ' : null}
                {previewRow.default_template_name ? `name ${previewRow.default_template_name}` : null}
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-[11px] font-semibold text-foreground hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-5 py-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save WhatsApp templates'}
        </button>
      </div>
    </form>
  );
}
