'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { RBAC_MODULE_DEFS } from '@/lib/rbac';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useAgencyUsers } from '@/hooks/useAgencyUsers';
import { useAuditLogFeed } from '@/hooks/useAuditLogFeed';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import {
  Search,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

const CRUD_PERM = ['view', 'create', 'edit', 'delete'] as const;

export default function EmployeesPage() {
  const { currentAgency, logAction, roleDefinitions } = useStore();
  const { users } = useAgencyUsers();
  const { auditLogs } = useAuditLogFeed();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoleMatrixId, setSelectedRoleMatrixId] = useState('');

  const agencyRoleDefs = useMemo(
    () =>
      roleDefinitions
        .filter((r) => r.agencyId === currentAgency.id)
        .sort((a, b) => {
          if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [roleDefinitions, currentAgency.id],
  );

  const agencyUsers = users.filter(
    (u) =>
      u.agencyId === currentAgency.id &&
      (u.name + ' ' + u.role + ' ' + u.email).toLowerCase().includes(search.toLowerCase()),
  );

  /** Default matrix role + staff selection */
  useEffect(() => {
    if (agencyRoleDefs.length === 0) {
      setSelectedRoleMatrixId('');
      return;
    }
    if (
      !selectedRoleMatrixId ||
      !agencyRoleDefs.some((r) => r.id === selectedRoleMatrixId)
    ) {
      setSelectedRoleMatrixId(agencyRoleDefs[0].id);
    }
  }, [agencyRoleDefs, selectedRoleMatrixId]);

  useEffect(() => {
    if (agencyUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(agencyUsers[0].id);
    }
  }, [agencyUsers, selectedUserId]);

  const activeUser = agencyUsers.find((u) => u.id === selectedUserId);
  const agencyAuditLogs = auditLogs.filter((log) => log.agencyId === currentAgency.id);
  const matrixRole = agencyRoleDefs.find((r) => r.id === selectedRoleMatrixId);
  const rbacRowsPagination = useClientPagination([...RBAC_MODULE_DEFS], undefined, [selectedRoleMatrixId]);

  const handleRoleChange = (userId: string, newRoleName: string) => {
    const userToUpdate = users.find((u) => u.id === userId);
    if (!userToUpdate) return;

    useStore.getState().setCurrentUser({
      ...userToUpdate,
      role: newRoleName,
    });

    const updatedList = users.map((u) =>
      u.id === userId ? { ...u, role: newRoleName } : u,
    );
    useStore.setState({ users: updatedList });

    logAction(
      'UPDATE',
      'UserRole',
      `Transferred role of ${userToUpdate.name} to ${newRoleName}`,
    );
    alert(`Access Level updated for ${userToUpdate.name}.`);

    const nextDef = agencyRoleDefs.find((r) => r.name === newRoleName);
    if (nextDef) setSelectedRoleMatrixId(nextDef.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">
            Access Control & Staff Registry
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Modify employee security roles, inspect real-time RBAC module permissions, and audit user logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 text-xs items-start">
        <div className="lg:col-span-2 p-5 bg-card border border-border rounded-xl space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Staff Directory</h2>

          <div className="relative text-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff by name or designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary/40 border border-border focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {agencyUsers.map((usr) => (
              <div
                key={usr.id}
                onClick={() => {
                  setSelectedUserId(usr.id);
                  const rd = agencyRoleDefs.find((r) => r.name === usr.role);
                  if (rd) setSelectedRoleMatrixId(rd.id);
                }}
                className={`p-3 bg-secondary/20 hover:bg-secondary/40 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                  selectedUserId === usr.id ? 'border-primary bg-primary/5' : 'border-border/50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {usr.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{usr.name}</h4>
                    <span className="text-[9px] text-muted-foreground">{usr.email}</span>
                  </div>
                </div>

                <div className="text-right">
                  <select
                    value={usr.role}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleRoleChange(usr.id, e.target.value)}
                    className="px-2 py-1 bg-card border border-border rounded text-[10px] focus:outline-none max-w-[160px]"
                  >
                    {!agencyRoleDefs.some((r) => r.name === usr.role) && usr.role.trim() !== '' ? (
                      <option value={usr.role}>
                        {usr.role} (unmapped — assign a defined role)
                      </option>
                    ) : null}
                    {agencyRoleDefs.map((roleDef) => (
                      <option key={roleDef.id} value={roleDef.name}>
                        {roleDef.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {agencyUsers.length === 0 && (
              <p className="text-center py-6 text-muted-foreground">No staff matched.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="p-5 bg-card border border-border rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                RBAC Access Rights Matrix
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-muted-foreground">Role:</span>
                <select
                  value={selectedRoleMatrixId}
                  onChange={(e) => setSelectedRoleMatrixId(e.target.value)}
                  className="px-2 py-1 bg-secondary border border-border rounded text-[10px] focus:outline-none font-semibold text-primary max-w-[200px]"
                >
                  {agencyRoleDefs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.isSystem ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!matrixRole && (
              <p className="text-center text-muted-foreground py-4 text-[11px]">
                Define roles under Workspace Settings to see this matrix.
              </p>
            )}

            {matrixRole && (
              <>
                <p className="text-[10px] text-muted-foreground">
                  Source of truth: <span className="font-semibold text-foreground">Settings → Roles & permissions</span>
                  .
                  {activeUser && activeUser.role === matrixRole.name
                    ? ' Matches the highlighted staff row.'
                    : ` Inspecting "${matrixRole.name}" — ${activeUser ? `${activeUser.name} is assigned as ${activeUser.role}.` : ''}`}
                </p>
                <CrmTablePanel>
                <div className="crm-table-wrap">
                <div className="overflow-x-auto text-[11px]">
                  <table className="crm-data-table">
                    <thead>
                      <tr>
                        <th>Workspace Module</th>
                        <th className="text-center">View</th>
                        <th className="text-center">Create</th>
                        <th className="text-center">Edit</th>
                        <th className="text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rbacRowsPagination.pageItems.map(({ key, label }) => {
                        const row = matrixRole.permissions[key];
                        return (
                          <tr key={key}>
                            <td className="font-medium">{label}</td>
                            {CRUD_PERM.map((p) => (
                              <td key={p} className="text-center">
                                {row[p] ? (
                                  <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500 mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <CrmTablePagination
                  label="RBAC modules"
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

                <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-[10px] text-indigo-300 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span>
                    Interactive editing lives in Workspace Settings — this screen stays read-only so desk staff can inspect
                    entitlements safely.
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="p-5 bg-card border border-border rounded-xl space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Staff Logs Audit Trail</h2>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {agencyAuditLogs.map((log, i) => (
                <div
                  key={`${log.id}-${i}`}
                  className="p-2.5 rounded-lg bg-secondary/35 border border-border/30 text-xs flex justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-foreground">{log.userName}</span>
                      <span className="text-[8px] px-1 rounded bg-secondary text-muted-foreground border border-border/50 uppercase font-bold">
                        {log.action}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{log.details}</p>
                  </div>
                  <span className="text-[9px] text-muted-foreground text-right shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {agencyAuditLogs.length === 0 && (
                <p className="text-center py-6 text-muted-foreground">No logs recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
