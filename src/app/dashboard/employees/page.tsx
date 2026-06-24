'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { RBAC_MODULE_DEFS, canManageRoleDefinitions } from '@/lib/rbac';
import { useAgencyUsers } from '@/hooks/useAgencyUsers';
import { useAgencyRoleCatalog } from '@/hooks/useAgencyRoleCatalog';
import { useAuditLogFeed } from '@/hooks/useAuditLogFeed';
import { Search, Plus, X } from 'lucide-react';
import { StaffUsersTablePanel } from '@/components/staff/StaffUsersTablePanel';
import { useCrmToast } from '@/components/ui/CrmToastProvider';
import { apiRoleIdFromDefinition } from '@/lib/api/role-catalog';
import type { User } from '@/lib/store';

const StaffRolesPermissionsPanel = dynamic(
  () =>
    import('@/components/staff/StaffRolesPermissionsPanel').then((m) => ({
      default: m.StaffRolesPermissionsPanel,
    })),
  {
    loading: () => <StaffPanelSkeleton rows={6} />,
  },
);

type StaffTab = 'members' | 'users' | 'roles';

function StaffRowSkeleton() {
  return (
    <div className="crm-staff-row crm-staff-row--skeleton" aria-hidden>
      <div className="crm-staff-row__identity">
        <span className="crm-staff-row__avatar crm-skeleton" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <span className="crm-skeleton crm-skeleton--line w-28" />
          <span className="crm-skeleton crm-skeleton--line w-36" />
        </div>
      </div>
      <span className="crm-skeleton crm-skeleton--pill w-24" />
    </div>
  );
}

function StaffPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="crm-staff-list">
      {Array.from({ length: rows }, (_, i) => (
        <StaffRowSkeleton key={i} />
      ))}
    </div>
  );
}

export default function EmployeesPage() {
  const { currentAgency, currentUser, logAction, roleDefinitions } = useStore();
  const { users, loading, error, createStaffUser, updateStaffUser, deleteStaffUser, updateStaffRole } =
    useAgencyUsers();
  const { agencyRoleDefs, refresh: refreshRoleCatalog } = useAgencyRoleCatalog();
  const { showToast } = useCrmToast();
  const [staffTab, setStaffTab] = useState<StaffTab>('members');
  const { auditLogs, loading: auditLoading } = useAuditLogFeed(staffTab === 'members');
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [, setDeletingUserId] = useState<string | null>(null);

  const allAgencyUsers = useMemo(
    () => users.filter((u) => u.agencyId === currentAgency.id),
    [users, currentAgency.id],
  );

  const agencyUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.agencyId === currentAgency.id &&
          (u.name + ' ' + u.role + ' ' + u.email).toLowerCase().includes(search.toLowerCase()),
      ),
    [users, currentAgency.id, search],
  );

  useEffect(() => {
    if (agencyUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(agencyUsers[0].id);
    }
  }, [agencyUsers, selectedUserId]);

  const activeUser = agencyUsers.find((u) => u.id === selectedUserId);
  const activeRoleDef = agencyRoleDefs.find((r) => r.name === activeUser?.role);
  const agencyAuditLogs = useMemo(
    () => auditLogs.filter((log) => log.agencyId === currentAgency.id),
    [auditLogs, currentAgency.id],
  );

  const canAddStaff = !!(
    currentUser &&
    canManageRoleDefinitions(currentUser.role, currentAgency.id, roleDefinitions)
  );

  useEffect(() => {
    if (agencyRoleDefs.length > 0 && !newRoleName) {
      setNewRoleName(agencyRoleDefs[0].name);
    }
  }, [agencyRoleDefs, newRoleName]);

  const resetCreateForm = () => {
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
    setNewRoleName(agencyRoleDefs[0]?.name ?? '');
    setCreateError(null);
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim() || !newRoleName) {
      setCreateError('Name, email, password, and role are required.');
      return;
    }
    if (newPassword.length < 8) {
      setCreateError('Password must be at least 8 characters.');
      return;
    }

    void (async () => {
      setCreating(true);
      setCreateError(null);
      try {
        const assignRoleDef = agencyRoleDefs.find((r) => r.name === newRoleName);
        const created = await createStaffUser({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          phone: newPhone.trim() || undefined,
          roleName: newRoleName,
          roleId: assignRoleDef ? apiRoleIdFromDefinition(assignRoleDef) : undefined,
        });
        logAction(
          'CREATE',
          'User',
          `Created staff account for ${created.name} (${created.email}) as ${newRoleName}`,
        );
        setSelectedUserId(created.id);
        setShowCreateModal(false);
        resetCreateForm();
        showToast({ message: `${created.name} added to the team`, variant: 'success' });
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create user');
        showToast({
          message: err instanceof Error ? err.message : 'Failed to create user',
          variant: 'error',
        });
      } finally {
        setCreating(false);
      }
    })();
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone ?? '');
    setEditRoleName(user.role);
    setEditPassword('');
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditError(null);
    setEditPassword('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim() || !editRoleName) {
      setEditError('Name, email, and role are required.');
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setEditError('New password must be at least 8 characters.');
      return;
    }

    void (async () => {
      setSavingEdit(true);
      setEditError(null);
      try {
        const roleDef = agencyRoleDefs.find((r) => r.name === editRoleName);
        const updated = await updateStaffUser(editingUser.id, {
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim() || null,
          ...(editPassword ? { password: editPassword } : {}),
          roleName: editRoleName,
          roleId: roleDef ? apiRoleIdFromDefinition(roleDef) : undefined,
        });
        if (currentUser?.id === editingUser.id) {
          useStore.getState().setCurrentUser({
            ...currentUser,
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            role: updated.role,
          });
        }
        if (selectedUserId === editingUser.id) {
          setSelectedUserId(updated.id);
        }
        logAction('UPDATE', 'User', `Updated profile for ${updated.name} (${updated.email})`);
        showToast({ message: `${updated.name} updated`, variant: 'success' });
        closeEditModal();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update user';
        setEditError(message);
        showToast({ message, variant: 'error' });
      } finally {
        setSavingEdit(false);
      }
    })();
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      showToast({ message: 'You cannot delete your own account', variant: 'error' });
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Remove ${user.name} (${user.email}) from this workspace?`)
    ) {
      return;
    }

    void (async () => {
      setDeletingUserId(user.id);
      try {
        await deleteStaffUser(user.id);
        if (selectedUserId === user.id) {
          setSelectedUserId('');
        }
        logAction('DELETE', 'User', `Removed staff account ${user.name} (${user.email})`);
        showToast({ message: `${user.name} removed`, variant: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete user';
        showToast({ message, variant: 'error' });
      } finally {
        setDeletingUserId(null);
      }
    })();
  };

  const handleRoleChange = (userId: string, nextRoleName: string) => {
    const userToUpdate = users.find((u) => u.id === userId);
    if (!userToUpdate || userToUpdate.role === nextRoleName) return;

    const roleDef = agencyRoleDefs.find((r) => r.name === nextRoleName);
    const roleId = roleDef ? apiRoleIdFromDefinition(roleDef) : undefined;

    void (async () => {
      try {
        await updateStaffRole(userId, nextRoleName, roleId);
        if (currentUser?.id === userId) {
          useStore.getState().setCurrentUser({
            ...currentUser,
            role: nextRoleName,
          });
        }
        logAction(
          'UPDATE',
          'UserRole',
          `Transferred role of ${userToUpdate.name} to ${nextRoleName}`,
        );
        showToast({
          message: `${userToUpdate.name} is now ${nextRoleName}`,
          variant: 'success',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update role';
        showToast({ message, variant: 'error' });
      }
    })();
  };

  const grantedModuleCount = activeRoleDef
    ? RBAC_MODULE_DEFS.filter(({ key }) => activeRoleDef.permissions[key].view).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">Team access</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Manage staff accounts, assign roles, and configure module permissions for your workspace.
          </p>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          staffTab === 'roles' || staffTab === 'users' ? '' : 'lg:grid-cols-5'
        }`}
      >
        <div
          className={`crm-staff-card ${
            staffTab === 'roles' || staffTab === 'users' ? '' : 'lg:col-span-2'
          }`}
        >
          <div className="crm-staff-card__header">
            <div>
              <h2 className="crm-staff-card__title">Staff directory</h2>
              <p className="crm-staff-card__subtitle">
                {staffTab === 'members'
                  ? 'Search, assign roles, and onboard new team members.'
                  : staffTab === 'users'
                    ? 'Full directory of workspace accounts with contact details and role assignments.'
                    : 'Define roles and tune module access — names must match staff assignments exactly.'}
              </p>
            </div>
            <div className="crm-staff-tabs" role="tablist" aria-label="Staff directory views">
              <button
                type="button"
                role="tab"
                aria-selected={staffTab === 'members'}
                className={`crm-staff-tabs__btn ${staffTab === 'members' ? 'crm-staff-tabs__btn--active' : ''}`}
                onClick={() => setStaffTab('members')}
              >
                Team members
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={staffTab === 'users'}
                className={`crm-staff-tabs__btn ${staffTab === 'users' ? 'crm-staff-tabs__btn--active' : ''}`}
                onClick={() => setStaffTab('users')}
              >
                Users
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={staffTab === 'roles'}
                className={`crm-staff-tabs__btn ${staffTab === 'roles' ? 'crm-staff-tabs__btn--active' : ''}`}
                onClick={() => setStaffTab('roles')}
              >
                Roles &amp; permissions
              </button>
            </div>
          </div>

          {staffTab === 'members' && (
            <>
              <div className="crm-filter-bar text-xs">
                <div className="crm-filter-bar__search">
                  <Search className="crm-filter-bar__search-icon" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="crm-filter-bar__input"
                  />
                </div>
                {canAddStaff && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="crm-btn-primary !w-auto shrink-0 px-3 py-2 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add member
                  </button>
                )}
              </div>

              {error && <div className="crm-alert-error text-[11px]">{error}</div>}

              {loading && users.length === 0 ? (
                <StaffPanelSkeleton rows={5} />
              ) : (
              <div className="crm-staff-list">
                {agencyUsers.map((usr) => (
                  <div
                    key={usr.id}
                    onClick={() => setSelectedUserId(usr.id)}
                    className={`crm-staff-row ${selectedUserId === usr.id ? 'crm-staff-row--active' : ''}`}
                  >
                    <div className="crm-staff-row__identity">
                      <span className="crm-staff-row__avatar">{usr.name.charAt(0)}</span>
                      <div className="min-w-0">
                        <p className="crm-staff-row__name">{usr.name}</p>
                        <span className="crm-staff-row__email">{usr.email}</span>
                      </div>
                    </div>
                    <select
                      value={usr.role}
                      onChange={(e) => handleRoleChange(usr.id, e.target.value)}
                      className="crm-staff-row__role"
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
                  </div>
                ))}
                {!loading && agencyUsers.length === 0 && (
                  <p className="crm-staff-empty">No team members matched your search.</p>
                )}
              </div>
              )}
            </>
          )}

          {staffTab === 'users' && (
            <StaffUsersTablePanel
              users={allAgencyUsers}
              loading={loading}
              error={error}
              agencyRoleDefs={agencyRoleDefs}
              currentUserId={currentUser?.id}
              canManage={canAddStaff}
              onRoleChange={handleRoleChange}
              onEdit={openEditModal}
              onDelete={handleDeleteUser}
              onAddUser={openCreateModal}
            />
          )}

          {staffTab === 'roles' && (
            <StaffRolesPermissionsPanel onRolesChanged={() => void refreshRoleCatalog()} />
          )}
        </div>

        {staffTab === 'members' && (
          <div className="lg:col-span-3 space-y-6">
            <div className="crm-access-overview">
              <div className="crm-access-overview__head">
                <div>
                  <h2 className="crm-access-overview__title">Access overview</h2>
                  {activeUser && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Effective permissions for{' '}
                      <span className="font-semibold text-foreground">{activeUser.name}</span>
                    </p>
                  )}
                </div>
                {activeUser && (
                  <span className="crm-access-overview__role-pill">{activeUser.role}</span>
                )}
              </div>

              {!activeUser && (
                <p className="crm-staff-empty">Select a team member to inspect their module access.</p>
              )}

              {activeUser && !activeRoleDef && (
                <p className="crm-staff-empty">
                  Role &quot;{activeUser.role}&quot; is not defined in Roles &amp; permissions. Assign a
                  defined role or create one in the Roles tab.
                </p>
              )}

              {activeUser && activeRoleDef && (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    {grantedModuleCount} of {RBAC_MODULE_DEFS.length} modules with view access
                  </p>
                  <div className="crm-access-grid">
                    {RBAC_MODULE_DEFS.map(({ key, label }) => {
                      const perms = activeRoleDef.permissions[key];
                      const allowed = perms.view;
                      return (
                        <div
                          key={key}
                          className={`crm-access-chip ${allowed ? 'crm-access-chip--allowed' : 'crm-access-chip--denied'}`}
                        >
                          <span className="crm-access-chip__label">{label}</span>
                          <span className="crm-access-chip__value">
                            {allowed
                              ? [
                                  perms.view && 'View',
                                  perms.create && 'Create',
                                  perms.edit && 'Edit',
                                  perms.delete && 'Delete',
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || 'View'
                              : 'No access'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="crm-audit-panel">
              <h2 className="crm-audit-panel__title">Activity log</h2>
              <div className="crm-audit-list">
                {auditLoading && agencyAuditLogs.length === 0 ? (
                  <StaffPanelSkeleton rows={3} />
                ) : (
                  <>
                {agencyAuditLogs.map((log, i) => (
                  <div key={`${log.id}-${i}`} className="crm-audit-item">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{log.userName}</span>
                        <span className="crm-audit-item__action">{log.action}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
                {agencyAuditLogs.length === 0 && !auditLoading && (
                  <p className="crm-staff-empty">No activity recorded yet.</p>
                )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">Add team member</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="p-1 rounded hover:bg-secondary"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Phone <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Temporary password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Minimum 8 characters. Share securely with the new user.
                </p>
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Assign role
                </label>
                <select
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                >
                  {agencyRoleDefs.map((roleDef) => (
                    <option key={roleDef.id} value={roleDef.name}>
                      {roleDef.name}
                      {roleDef.isSystem ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
              </div>

              {createError && <div className="crm-alert-error text-[11px]">{createError}</div>}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="crm-btn-primary !w-auto px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {creating ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">Edit user</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1 rounded hover:bg-secondary"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Phone <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                >
                  {!agencyRoleDefs.some((r) => r.name === editRoleName) && editRoleName.trim() !== '' ? (
                    <option value={editRoleName}>{editRoleName} (unmapped)</option>
                  ) : null}
                  {agencyRoleDefs.map((roleDef) => (
                    <option key={roleDef.id} value={roleDef.name}>
                      {roleDef.name}
                      {roleDef.isSystem ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  New password <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>

              {editError && <div className="crm-alert-error text-[11px]">{editError}</div>}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="crm-btn-primary !w-auto px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
