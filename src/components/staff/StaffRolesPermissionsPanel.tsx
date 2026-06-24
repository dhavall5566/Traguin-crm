'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  RBAC_MODULE_DEFS,
  canManageRoleDefinitions,
  type RbacCrudSet,
  type RbacModuleKey,
  type RoleDefinition,
} from '@/lib/rbac';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { useCrmToast } from '@/components/ui/CrmToastProvider';
import { createAgencyRole } from '@/lib/api/rbac';
import { syncAgencyRoleCatalog } from '@/lib/api/role-catalog';
import { useAgencyRoleCatalog } from '@/hooks/useAgencyRoleCatalog';
import { Check, Shield, Trash2, X } from 'lucide-react';

const CRUD_COLUMNS: Array<{ key: keyof RbacCrudSet; label: string }> = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

function matrixColumnState(role: RoleDefinition, permission: keyof RbacCrudSet) {
  const values = RBAC_MODULE_DEFS.map((m) => role.permissions[m.key][permission]);
  const allOn = values.every(Boolean);
  return { allOn, indeterminate: !allOn && !values.every((v) => !v) };
}

function matrixRowState(role: RoleDefinition, moduleKey: RbacModuleKey) {
  const row = role.permissions[moduleKey];
  const values = CRUD_COLUMNS.map((c) => row[c.key]);
  const allOn = values.every(Boolean);
  return { allOn, indeterminate: !allOn && !values.every((v) => !v) };
}

type MatrixSelectAllCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel: string;
};

function MatrixSelectAllCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onToggle,
  ariaLabel,
}: MatrixSelectAllCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="crm-rbac-matrix__checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      aria-label={ariaLabel}
    />
  );
}

type StaffRolesPermissionsPanelProps = {
  onRoleSelected?: (roleId: string) => void;
  onRolesChanged?: () => void;
};

export function StaffRolesPermissionsPanel({
  onRoleSelected,
  onRolesChanged,
}: StaffRolesPermissionsPanelProps) {
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);
  const roleDefinitions = useStore((s) => s.roleDefinitions);
  const addRoleDefinition = useStore((s) => s.addRoleDefinition);
  const renameRoleDefinition = useStore((s) => s.renameRoleDefinition);
  const deleteRoleDefinition = useStore((s) => s.deleteRoleDefinition);
  const setRoleModulePermission = useStore((s) => s.setRoleModulePermission);
  const setRoleModuleRowAll = useStore((s) => s.setRoleModuleRowAll);
  const setRoleModuleColumnAll = useStore((s) => s.setRoleModuleColumnAll);
  const { agencyRoleDefs: agencyRoles } = useAgencyRoleCatalog();
  const { showToast } = useCrmToast();
  const permToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyPermissionsUpdated = () => {
    if (permToastTimerRef.current) clearTimeout(permToastTimerRef.current);
    permToastTimerRef.current = setTimeout(() => {
      showToast({ message: 'Permissions updated', variant: 'success' });
    }, 650);
  };

  useEffect(() => {
    return () => {
      if (permToastTimerRef.current) clearTimeout(permToastTimerRef.current);
    };
  }, []);

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [cloneFromRoleId, setCloneFromRoleId] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [roleFormError, setRoleFormError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const canEditRolesMatrix = !!(
    currentUser &&
    canManageRoleDefinitions(currentUser.role, currentAgency.id, roleDefinitions)
  );

  const selectedRole: RoleDefinition | undefined = agencyRoles.find((r) => r.id === selectedRoleId);

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
    if (selectedRole) {
      setRenameDraft(selectedRole.name);
      onRoleSelected?.(selectedRole.id);
    }
  }, [selectedRole?.id, selectedRole?.name, onRoleSelected]);

  const totalPages = Math.max(1, Math.ceil(RBAC_MODULE_DEFS.length / pageSize));
  const pageItems = RBAC_MODULE_DEFS.slice((page - 1) * pageSize, page * pageSize);

  const submitNewRole = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleFormError('');
    const trimmed = newRoleName.trim();
    if (!trimmed) {
      setRoleFormError('Enter a role name.');
      return;
    }
    const created = addRoleDefinition(trimmed, cloneFromRoleId.trim() || undefined);
    if (!created) {
      setRoleFormError(`A role named "${trimmed}" already exists in this agency.`);
      return;
    }
    setNewRoleName('');
    setCloneFromRoleId('');
    setSelectedRoleId(created.id);
    showToast({ message: `Role "${trimmed}" created`, variant: 'success' });

    void (async () => {
      try {
        await createAgencyRole(trimmed);
        await syncAgencyRoleCatalog(currentAgency.id);
        onRolesChanged?.();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Role saved in permissions matrix but server sync failed.';
        setRoleFormError(message);
        showToast({ message, variant: 'error' });
      }
    })();
  };

  const applyRename = () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setRoleFormError('');
    const ok = renameRoleDefinition(selectedRole.id, renameDraft);
    if (!ok) {
      setRoleFormError('Could not rename: duplicate name or permission denied.');
      showToast({ message: 'Could not save role name', variant: 'error' });
      return;
    }
    showToast({ message: 'Role name saved', variant: 'success' });
  };

  const removeCustomRole = () => {
    if (!selectedRole || selectedRole.isSystem) return;
    setRoleFormError('');
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Remove the custom role "${selectedRole.name}"?`)
    ) {
      return;
    }
    const removedName = selectedRole.name;
    const ok = deleteRoleDefinition(selectedRole.id);
    if (!ok) {
      setRoleFormError('Cannot remove this role while staff members are still assigned to it.');
      showToast({ message: 'Cannot delete role — still assigned to staff', variant: 'error' });
      return;
    }
    showToast({ message: `Role "${removedName}" deleted`, variant: 'success' });
  };

  const togglePermission = (moduleKey: RbacModuleKey, permission: keyof RbacCrudSet) => {
    if (!selectedRole || !canEditRolesMatrix) return;
    const current = selectedRole.permissions[moduleKey][permission];
    setRoleModulePermission(selectedRole.id, moduleKey, permission, !current);
    notifyPermissionsUpdated();
  };

  const toggleRowAll = (moduleKey: RbacModuleKey) => {
    if (!selectedRole || !canEditRolesMatrix) return;
    const { allOn } = matrixRowState(selectedRole, moduleKey);
    setRoleModuleRowAll(selectedRole.id, moduleKey, !allOn);
    showToast({ message: 'Row permissions updated', variant: 'success' });
  };

  const toggleColumnAll = (permission: keyof RbacCrudSet) => {
    if (!selectedRole || !canEditRolesMatrix) return;
    const { allOn } = matrixColumnState(selectedRole, permission);
    setRoleModuleColumnAll(selectedRole.id, permission, !allOn);
    showToast({ message: `${CRUD_COLUMNS.find((c) => c.key === permission)?.label ?? 'Column'} permissions updated`, variant: 'success' });
  };

  if (agencyRoles.length === 0) {
    return (
      <p className="crm-staff-empty">No roles configured for this workspace yet.</p>
    );
  }

  return (
    <div className="crm-rbac-panel space-y-4">
      <div className="crm-rbac-panel__intro">
        <Shield className="crm-rbac-panel__intro-icon" aria-hidden />
        <p>
          Define module access per role. Names must match exactly when assigning staff in the Team members tab.
        </p>
      </div>

      {!canEditRolesMatrix && (
        <div className="crm-rbac-panel__notice">
          Read-only view. Only administrators or roles with Access &amp; Staff Control · Create/Edit can modify
          permissions.
        </div>
      )}

      <div className="crm-rbac-toolbar">
        <label className="crm-rbac-toolbar__field">
          <span className="crm-rbac-toolbar__label">Active role</span>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="crm-rbac-toolbar__select"
          >
            {agencyRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isSystem ? ' · System' : ' · Custom'}
              </option>
            ))}
          </select>
        </label>

        {!selectedRole?.isSystem && canEditRolesMatrix && selectedRole && (
          <div className="crm-rbac-toolbar__actions">
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="crm-rbac-toolbar__input"
              aria-label="Rename role"
            />
            <button type="button" onClick={applyRename} className="crm-btn-outline crm-rbac-toolbar__btn">
              Save name
            </button>
            <button
              type="button"
              onClick={removeCustomRole}
              className="crm-btn-danger crm-btn-danger--compact crm-rbac-toolbar__btn"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>

      {canEditRolesMatrix && (
        <form onSubmit={submitNewRole} className="crm-rbac-create">
          <span className="crm-rbac-create__label">New role</span>
          <div className="crm-rbac-create__row">
            <input
              type="text"
              placeholder="Role name, e.g. Concierge"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="crm-rbac-create__input"
            />
            <select
              value={cloneFromRoleId}
              onChange={(e) => setCloneFromRoleId(e.target.value)}
              className="crm-rbac-create__select"
              aria-label="Clone permissions from"
            >
              <option value="">Blank template (deny all)</option>
              {agencyRoles.map((r) => (
                <option key={`clone-${r.id}`} value={r.id}>
                  Clone · {r.name}
                </option>
              ))}
            </select>
            <button type="submit" className="crm-btn-primary crm-rbac-create__submit">
              Add role
            </button>
          </div>
          {roleFormError && <p className="crm-rbac-create__error">{roleFormError}</p>}
        </form>
      )}

      {selectedRole && (
        <div className="crm-rbac-matrix">
          <div className="crm-rbac-matrix__head">
            <span className="crm-rbac-matrix__title">Module permissions</span>
            <span className="crm-rbac-matrix__meta">
              {selectedRole.name}
              {selectedRole.isSystem ? ' · System role' : ' · Custom role'}
            </span>
          </div>
          <div className="crm-rbac-matrix__table-wrap">
            <table className="crm-rbac-matrix__table">
              <thead>
                <tr>
                  <th>
                    <span className="crm-rbac-matrix__th-stack">
                      <span>Module</span>
                    </span>
                  </th>
                  {CRUD_COLUMNS.map((c) => {
                    const col = selectedRole
                      ? matrixColumnState(selectedRole, c.key)
                      : { allOn: false, indeterminate: false };
                    return (
                      <th key={c.key}>
                        <span className="crm-rbac-matrix__th-stack">
                          <span>{c.label}</span>
                          <MatrixSelectAllCheckbox
                            checked={col.allOn}
                            indeterminate={col.indeterminate}
                            disabled={!canEditRolesMatrix}
                            onToggle={() => toggleColumnAll(c.key)}
                            ariaLabel={`Select all ${c.label} permissions`}
                          />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageItems.map(({ key: modKey, label }) => {
                  const row = selectedRole
                    ? matrixRowState(selectedRole, modKey)
                    : { allOn: false, indeterminate: false };
                  return (
                  <tr key={modKey}>
                    <td>
                      <span className="crm-rbac-matrix__row-head">
                        <MatrixSelectAllCheckbox
                          checked={row.allOn}
                          indeterminate={row.indeterminate}
                          disabled={!canEditRolesMatrix}
                          onToggle={() => toggleRowAll(modKey)}
                          ariaLabel={`Select all permissions for ${label}`}
                        />
                        <span>{label}</span>
                      </span>
                    </td>
                    {CRUD_COLUMNS.map(({ key: permKey }) => {
                      const on = selectedRole.permissions[modKey][permKey];
                      return (
                        <td key={`${modKey}-${String(permKey)}`}>
                          {canEditRolesMatrix ? (
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => togglePermission(modKey, permKey)}
                              className={`crm-rbac-toggle ${on ? 'crm-rbac-toggle--on' : 'crm-rbac-toggle--off'}`}
                              title={`Toggle ${String(permKey)}`}
                            >
                              {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            </button>
                          ) : (
                            <span
                              className={`crm-rbac-toggle crm-rbac-toggle--static ${on ? 'crm-rbac-toggle--on' : 'crm-rbac-toggle--off'}`}
                            >
                              {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CrmTablePagination
            label="Modules"
            rangeStart={(page - 1) * pageSize + 1}
            rangeEnd={Math.min(page * pageSize, RBAC_MODULE_DEFS.length)}
            total={RBAC_MODULE_DEFS.length}
            page={page}
            totalPages={totalPages}
            hasPrev={page > 1}
            hasNext={page < totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}
    </div>
  );
}
