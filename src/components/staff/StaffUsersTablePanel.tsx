'use client';

import React, { useMemo, useState } from 'react';
import { useClientPagination } from '@/hooks/useClientPagination';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import type { User } from '@/lib/store';
import type { RoleDefinition } from '@/lib/rbac';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';

type StaffUsersTablePanelProps = {
  users: User[];
  loading: boolean;
  error: string | null;
  agencyRoleDefs: RoleDefinition[];
  currentUserId?: string;
  canManage: boolean;
  onRoleChange: (userId: string, roleName: string) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onAddUser: () => void;
};

export function StaffUsersTablePanel({
  users,
  loading,
  error,
  agencyRoleDefs,
  currentUserId,
  canManage,
  onRoleChange,
  onEdit,
  onDelete,
  onAddUser,
}: StaffUsersTablePanelProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const pagination = useClientPagination(filtered, undefined, [search]);

  return (
    <div className="crm-users-panel space-y-3">
      <div className="crm-users-panel__toolbar">
        <div className="relative flex-1 text-xs min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="search"
            placeholder="Search users by name, email, phone, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <span className="crm-users-panel__count">
          {loading && users.length === 0 ? '…' : `${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={onAddUser}
            className="crm-btn-primary !w-auto shrink-0 px-3 py-2 text-[11px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add user
          </button>
        )}
      </div>

      {error && <div className="crm-alert-error text-[11px]">{error}</div>}

      <CrmTablePanel>
        <div className="crm-table-wrap">
          {loading && users.length === 0 ? (
            <CrmTableSkeleton columns={6} rows={8} />
          ) : (
            <>
              <div className="overflow-x-auto text-xs">
                <table className="crm-data-table crm-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Status</th>
                      {canManage && <th className="crm-users-table__actions-col">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.pageItems.map((usr) => {
                      const isSelf = usr.id === currentUserId;
                      return (
                        <tr key={usr.id}>
                          <td>
                            <div className="crm-users-table__user">
                              <span className="crm-staff-row__avatar">{usr.name.charAt(0)}</span>
                              <span className="font-semibold text-foreground">{usr.name}</span>
                            </div>
                          </td>
                          <td className="text-muted-foreground">{usr.email}</td>
                          <td className="text-muted-foreground">{usr.phone || '—'}</td>
                          <td>
                            <select
                              value={usr.role}
                              onChange={(e) => onRoleChange(usr.id, e.target.value)}
                              className="crm-staff-row__role crm-users-table__role-select"
                              aria-label={`Role for ${usr.name}`}
                            >
                              {!agencyRoleDefs.some((r) => r.name === usr.role) && usr.role.trim() !== '' ? (
                                <option value={usr.role}>{usr.role} (unmapped)</option>
                              ) : null}
                              {agencyRoleDefs.map((roleDef) => (
                                <option key={roleDef.id} value={roleDef.name}>
                                  {roleDef.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span
                              className={`crm-users-table__status ${isSelf ? 'crm-users-table__status--self' : 'crm-users-table__status--active'}`}
                            >
                              {isSelf ? 'Signed in' : 'Active'}
                            </span>
                          </td>
                          {canManage && (
                            <td>
                              <div className="crm-users-table__actions">
                                <button
                                  type="button"
                                  onClick={() => onEdit(usr)}
                                  className="crm-users-table__action-btn"
                                  aria-label={`Edit ${usr.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(usr)}
                                  disabled={isSelf}
                                  className="crm-users-table__action-btn crm-users-table__action-btn--danger"
                                  aria-label={`Delete ${usr.name}`}
                                  title={isSelf ? 'You cannot delete your own account' : undefined}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {pagination.pageItems.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 6 : 5} className="crm-data-table__empty">
                          {search.trim()
                            ? 'No users matched your search.'
                            : 'No users in this workspace yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <CrmTablePagination
                label="Users"
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                total={pagination.total}
                page={pagination.page}
                totalPages={pagination.totalPages}
                hasPrev={pagination.hasPrev}
                hasNext={pagination.hasNext}
                onPrev={pagination.goPrev}
                onNext={pagination.goNext}
              />
            </>
          )}
        </div>
      </CrmTablePanel>
    </div>
  );
}
