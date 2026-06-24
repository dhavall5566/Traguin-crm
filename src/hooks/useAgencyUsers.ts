"use client";

import { useCallback, useEffect, useState } from "react";
import { setUserPrimaryRole } from "@/lib/api/rbac";
import {
  getCachedStaffDirectory,
  loadStaffDirectory,
  patchStaffUser,
  patchStaffUserRole,
  removeStaffUser,
} from "@/lib/api/staff-directory";
import {
  CRM_CACHE,
  prependCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import {
  createAgencyUser,
  deleteAgencyUser,
  updateAgencyUser,
  type AgencyUserCreateInput,
  type AgencyUserUpdateInput,
} from "@/lib/api/users";
import type { User } from "@/lib/store";

export function useAgencyUsers() {
  const cached = getCachedStaffDirectory();
  const [users, setUsers] = useState<User[]>(() => cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const hasCache = getCachedStaffDirectory().length > 0;
    if (!options?.silent && !hasCache) setLoading(true);
    setError(null);
    try {
      const enriched = await loadStaffDirectory({
        force: options?.force,
        syncRoles: options?.force ? false : undefined,
      });
      setUsers(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team members");
      if (!hasCache) setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh({ silent: getCachedStaffDirectory().length > 0 });
  }, [refresh]);

  const createStaffUser = useCallback(
    async (input: AgencyUserCreateInput & { roleName: string; roleId?: string }) => {
      const created = await createAgencyUser(input);
      await setUserPrimaryRole(created.id, input.roleName, input.roleId);
      const withRole = { ...created, role: input.roleName };
      prependCrmWorkspaceItem(CRM_CACHE.staff, withRole);
      setUsers((prev) => [withRole, ...prev.filter((u) => u.id !== withRole.id)]);
      return withRole;
    },
    [],
  );

  const updateStaffUser = useCallback(
    async (
      userId: string,
      input: AgencyUserUpdateInput & { roleName?: string; roleId?: string },
    ) => {
      const previous = users.find((u) => u.id === userId);
      const updated = await updateAgencyUser(userId, input);
      let next: User = { ...updated, role: previous?.role ?? "" };

      if (input.roleName && input.roleName !== previous?.role) {
        await setUserPrimaryRole(userId, input.roleName, input.roleId);
        next = { ...next, role: input.roleName };
      }

      patchStaffUser(userId, next);
      setUsers((prev) => prev.map((u) => (u.id === userId ? next : u)));
      return next;
    },
    [users],
  );

  const deleteStaffUser = useCallback(async (userId: string) => {
    await deleteAgencyUser(userId);
    removeStaffUser(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const updateStaffRole = useCallback(
    async (userId: string, roleName: string, roleId?: string) => {
      const previousRole = users.find((u) => u.id === userId)?.role;

      patchStaffUserRole(userId, roleName);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: roleName } : u)),
      );

      try {
        await setUserPrimaryRole(userId, roleName, roleId);
      } catch (e) {
        if (previousRole !== undefined) {
          patchStaffUserRole(userId, previousRole);
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: previousRole } : u)),
          );
        }
        throw e;
      }
    },
    [users],
  );

  return {
    users,
    loading,
    error,
    refresh,
    createStaffUser,
    updateStaffUser,
    deleteStaffUser,
    updateStaffRole,
  };
}
