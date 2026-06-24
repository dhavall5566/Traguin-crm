'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { canAccessModuleView } from '@/lib/rbac';
import {
  Download,
  LayoutPanelLeft,
  PanelLeftClose,
  Sparkles,
  Wallet,
} from 'lucide-react';

const APP_VERSION = '0.1.0';

export default function SettingsPage() {
  const router = useRouter();
  const workspacePreferences = useStore((s) => s.workspacePreferences);
  const setWorkspacePreferences = useStore((s) => s.setWorkspacePreferences);
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);

  const roleDefinitions = useStore((s) => s.roleDefinitions);

  const [dueDraft, setDueDraft] = useState(String(workspacePreferences.defaultInvoiceDueDays));

  React.useEffect(() => {
    setDueDraft(String(workspacePreferences.defaultInvoiceDueDays));
  }, [workspacePreferences.defaultInvoiceDueDays]);

  const canOpenSettingsPage = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'workspace_settings', roleDefinitions)
  );

  const persistDueDays = () => {
    const n = Math.min(365, Math.max(1, Math.round(Number(dueDraft)) || 30));
    setDueDraft(String(n));
    setWorkspacePreferences({ defaultInvoiceDueDays: n });
  };

  const exportWorkspaceSnapshot = () => {
    const {
      leads,
      customers,
      bookings,
      invoices,
      itineraries,
      currentAgency: agency,
    } = useStore.getState();
    const scope = (agencyId: string) => ({
      leads: leads.filter((l) => l.agencyId === agencyId).length,
      customers: customers.filter((c) => c.agencyId === agencyId).length,
      bookings: bookings.filter((b) => b.agencyId === agencyId).length,
      invoices: invoices.filter((i) => i.agencyId === agencyId).length,
      itineraries: itineraries.filter((i) => i.agencyId === agencyId).length,
    });
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'TravelCRM AeroERP snapshot',
      version: APP_VERSION,
      agencyId: agency.id,
      agencyName: agency.name,
      counts: scope(agency.id),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelcrm-snapshot-${agency.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (currentUser && !canOpenSettingsPage) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-xs shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-foreground">Workspace settings</h1>
        <p className="text-muted-foreground leading-relaxed">
          Your role does not include access to Workspace Settings. Ask an administrator to grant
          Workspace Settings · View under Team access → Roles &amp; permissions.
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 text-xs pb-10">
      <div className="border-b border-border/60 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Workspace settings</h1>
        <p className="mt-1.5 text-muted-foreground leading-relaxed text-[11px]">
          Layout and billing preferences for this workspace.
        </p>
      </div>

      {/* Layout density */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
            <LayoutPanelLeft className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Layout</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Tweak navigation density and main content padding without affecting data.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <PanelLeftClose className="h-4 w-4 text-muted-foreground shrink-0" />
              Compact sidebar links
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary shrink-0"
              checked={workspacePreferences.sidebarCompact}
              onChange={(e) => setWorkspacePreferences({ sidebarCompact: e.target.checked })}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
              Tighter workspace padding
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary shrink-0"
              checked={workspacePreferences.densePagePadding}
              onChange={(e) => setWorkspacePreferences({ densePagePadding: e.target.checked })}
            />
          </label>
        </div>
      </section>

      {/* Billing defaults */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Billing defaults</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Draft invoices issued from CRM use this due horizon from booking date (1–365 days).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="due-days" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Default due in (days)
            </label>
            <input
              id="due-days"
              type="number"
              min={1}
              max={365}
              value={dueDraft}
              onChange={(e) => setDueDraft(e.target.value)}
              onBlur={persistDueDays}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={persistDueDays}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground hover:opacity-95"
          >
            Apply
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 shrink-0">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Data & backups</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Lightweight JSON tally for your tenant — handy before migrations or QA.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportWorkspaceSnapshot}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold hover:bg-secondary"
          >
            <Download className="h-4 w-4 shrink-0" />
            Export agency snapshot (JSON)
          </button>
        </div>
      </section>


    </div>
  );
}
