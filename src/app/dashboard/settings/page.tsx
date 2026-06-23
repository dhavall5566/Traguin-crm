'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  RBAC_MODULE_DEFS,
  canAccessModuleView,
  canManageRoleDefinitions,
  type RbacCrudSet,
  type RoleDefinition,
  type RbacModuleKey,
} from '@/lib/rbac';
import { useClientPagination } from '@/hooks/useClientPagination';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import {
  Bell,
  Download,
  Info,
  LayoutPanelLeft,
  LogOut,
  Moon,
  MoonStar,
  PanelLeftClose,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Wallet,
  Check,
  X,
  Trash2,
} from 'lucide-react';

const APP_VERSION = '0.1.0';

const CRUD_COLUMNS: Array<{ key: keyof RbacCrudSet; label: string }> = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

export default function SettingsPage() {
  const router = useRouter();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const workspacePreferences = useStore((s) => s.workspacePreferences);
  const setWorkspacePreferences = useStore((s) => s.setWorkspacePreferences);
  const resetWorkspacePreferences = useStore((s) => s.resetWorkspacePreferences);
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);
  const clearAuthSession = useStore((s) => s.clearAuthSession);

  const roleDefinitions = useStore((s) => s.roleDefinitions);
  const addRoleDefinition = useStore((s) => s.addRoleDefinition);
  const renameRoleDefinition = useStore((s) => s.renameRoleDefinition);
  const deleteRoleDefinition = useStore((s) => s.deleteRoleDefinition);
  const setRoleModulePermission = useStore((s) => s.setRoleModulePermission);

  const [dueDraft, setDueDraft] = useState(String(workspacePreferences.defaultInvoiceDueDays));
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [cloneFromRoleId, setCloneFromRoleId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [roleFormError, setRoleFormError] = useState('');

  React.useEffect(() => {
    setDueDraft(String(workspacePreferences.defaultInvoiceDueDays));
  }, [workspacePreferences.defaultInvoiceDueDays]);

  const canOpenSettingsPage = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'workspace_settings', roleDefinitions)
  );

  const canEditRolesMatrix = !!(
    currentUser &&
    canManageRoleDefinitions(currentUser.role, currentAgency.id, roleDefinitions)
  );

  const agencyRoles = useMemo(() => {
    return roleDefinitions
      .filter((r) => r.agencyId === currentAgency.id)
      .sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [roleDefinitions, currentAgency.id]);

  const selectedRole: RoleDefinition | undefined = agencyRoles.find((r) => r.id === selectedRoleId);
  const rbacRowsPagination = useClientPagination([...RBAC_MODULE_DEFS], undefined, [selectedRoleId]);

  useEffect(() => {
    if (agencyRoles.length === 0) {
      setSelectedRoleId('');
      return;
    }
    if (!selectedRoleId || !agencyRoles.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(agencyRoles[0].id);
    }
  }, [agencyRoles, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) setRenameDraft(selectedRole.name);
  }, [selectedRole?.id, selectedRole?.name]);

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

  const handleLogout = async () => {
    await fetch('/api/crm/auth/logout', { method: 'POST', credentials: 'include' });
    clearAuthSession();
    router.push('/auth/login');
    router.refresh();
  };

  const submitNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleFormError('');
    const trimmed = newRoleName.trim();
    if (!trimmed) {
      setRoleFormError('Enter a role name.');
      return;
    }
    const cloneId = cloneFromRoleId.trim() || undefined;
    const created = addRoleDefinition(trimmed, cloneId);
    if (!created) {
      setRoleFormError(
        `A role named "${trimmed}" already exists in this agency (names are compared case-insensitively).`,
      );
      return;
    }
    setNewRoleName('');
    setCloneFromRoleId('');
    setSelectedRoleId(created.id);
  };

  const applyRename = () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setRoleFormError('');
    const ok = renameRoleDefinition(selectedRole.id, renameDraft);
    if (!ok) {
      setRoleFormError('Could not rename: duplicate name, or permission denied.');
    }
  };

  const removeCustomRole = () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setRoleFormError('');
    if (typeof window === 'undefined') return;
    if (
      !window.confirm(
        `Remove the custom role "${selectedRole.name}"? Nobody can be assigned to this role.`,
      )
    ) {
      return;
    }
    const ok = deleteRoleDefinition(selectedRole.id);
    if (!ok) {
      setRoleFormError(
        'Cannot remove this role while any staff member is still assigned to it.',
      );
    }
  };

  const togglePermission = (moduleKey: RbacModuleKey, permission: keyof RbacCrudSet) => {
    if (!selectedRole || !canEditRolesMatrix) return;
    const current = selectedRole.permissions[moduleKey][permission];
    setRoleModulePermission(selectedRole.id, moduleKey, permission, !current);
  };

  if (currentUser && !canOpenSettingsPage) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-xs shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-foreground">Workspace settings</h1>
        <p className="text-muted-foreground leading-relaxed">
          Your role does not include access to Workspace Settings. Ask an administrator to grant
          Workspace Settings · View under Roles & permissions.
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
          Preferences and role templates apply to this browser only.
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

      {/* Roles & permissions */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400 shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Roles & permissions</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Create tenant-specific roles or tune module access per role. Staff assignments remain on{' '}
              <span className="font-semibold text-foreground">Team access</span> — role names listed here must match
              dropdown assignments exactly.
            </p>
          </div>
        </div>

        {!canEditRolesMatrix && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
            Only Agency Admins, or roles with{' '}
            <span className="font-semibold">Access & Staff Control · Create / Edit</span>, can change this matrix.
            You may still inspect permissions below.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="settings-role-picker"
              className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Editing role
            </label>
            <select
              id="settings-role-picker"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {agencyRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isSystem ? ' (system)' : ''}
                </option>
              ))}
            </select>
          </div>
          {!selectedRole?.isSystem && canEditRolesMatrix && selectedRole && (
            <div className="flex flex-wrap items-end gap-2 flex-1 min-w-[240px]">
              <div className="flex-1 min-w-[160px]">
                <label
                  htmlFor="rename-role"
                  className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  Rename custom role
                </label>
                <input
                  id="rename-role"
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={applyRename}
                className="rounded-lg bg-secondary px-3 py-2 text-[11px] font-semibold border border-border hover:bg-secondary/80"
              >
                Save name
              </button>
              <button
                type="button"
                onClick={removeCustomRole}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
                title="Remove only if nobody uses this role"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>

        {canEditRolesMatrix && (
          <form
            onSubmit={submitNewRole}
            className="rounded-lg border border-border/60 bg-secondary/15 p-3 space-y-3"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Create new role
            </span>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="new-role-name" className="sr-only">
                  New role name
                </label>
                <input
                  id="new-role-name"
                  type="text"
                  placeholder='e.g. "Concierge"'
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label htmlFor="clone-from" className="sr-only">
                  Clone permissions from
                </label>
                <select
                  id="clone-from"
                  value={cloneFromRoleId}
                  onChange={(e) => setCloneFromRoleId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Start blank (deny all)</option>
                  {agencyRoles.map((r) => (
                    <option key={`clone-${r.id}`} value={r.id}>
                      Clone from {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground hover:opacity-95"
              >
                Add role
              </button>
            </div>
            {roleFormError && (
              <p className="text-[11px] text-destructive">{roleFormError}</p>
            )}
          </form>
        )}

        {selectedRole && (
          <>
            <CrmTablePanel>
            <div className="crm-table-wrap">
            <div className="overflow-x-auto">
              <table className="crm-data-table">
                <thead>
                  <tr>
                    <th>Workspace module</th>
                    {CRUD_COLUMNS.map((c) => (
                      <th key={c.key} className="text-center w-[72px]">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rbacRowsPagination.pageItems.map(({ key: modKey, label }) => (
                    <tr key={modKey}>
                      <td className="font-medium pr-4">{label}</td>
                      {CRUD_COLUMNS.map(({ key: permKey }) => {
                        const on = selectedRole.permissions[modKey][permKey];
                        return (
                          <td key={`${modKey}-${String(permKey)}`} className="text-center">
                            {canEditRolesMatrix ? (
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => togglePermission(modKey, permKey)}
                                className={`inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors ${
                                  on
                                    ? 'border-emerald-600/60 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'border-red-900/60 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                }`}
                                title={`Toggle ${String(permKey)}`}
                              >
                                {on ? (
                                  <Check className="h-4 w-4 shrink-0" />
                                ) : (
                                  <X className="h-4 w-4 shrink-0" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex justify-center w-full">
                                {on ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500/80" />
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CrmTablePagination
              label="Permission modules"
              rangeStart={rbacRowsPagination.rangeStart}
              rangeEnd={rbacRowsPagination.rangeEnd}
              total={rbacRowsPagination.total}
              page={rbacRowsPagination.page}
              totalPages={rbacRowsPagination.totalPages}
              hasPrev={rbacRowsPagination.hasPrev}
              hasNext={rbacRowsPagination.hasNext}
              onPrev={rbacRowsPagination.goPrev}
              onNext={rbacRowsPagination.goNext}
            />
            </div>
            </CrmTablePanel>

            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-[10px] text-indigo-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>
                Permission matrices are mirrored in sidebar navigation today; wire the same checks into your Next.js route
                handlers when you introduce authenticated APIs for production deployments.
              </span>
            </div>
          </>
        )}
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
