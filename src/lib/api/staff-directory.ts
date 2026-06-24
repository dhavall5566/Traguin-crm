import {
  CRM_CACHE,
  getCrmWorkspaceList,
  invalidateCrmWorkspace,
  patchCrmWorkspaceItem,
  removeCrmWorkspaceItem,
  setCrmWorkspaceList,
} from "@/lib/api/crm-workspace-store";
import { syncAgencyRoleCatalog } from "@/lib/api/role-catalog";
import { listAgencyRoles, listAgencyUserRoles } from "@/lib/api/rbac";
import { listAgencyUsers } from "@/lib/api/users";
import type { User } from "@/lib/store";

let inFlight: Promise<User[]> | null = null;

function enrichStaffWithRoles(
  staff: User[],
  roles: Awaited<ReturnType<typeof listAgencyRoles>>,
  assignments: Awaited<ReturnType<typeof listAgencyUserRoles>>,
): User[] {
  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const primaryRoleIdByUser = new Map<string, string>();
  for (const row of assignments) {
    if (!primaryRoleIdByUser.has(row.user_id)) {
      primaryRoleIdByUser.set(row.user_id, row.role_id);
    }
  }
  return staff.map((user) => {
    const roleId = primaryRoleIdByUser.get(user.id);
    if (!roleId) return user;
    return {
      ...user,
      role: roleNameById.get(roleId) ?? user.role,
    };
  });
}

/** Cached + deduped staff directory (3 API calls, parallel). */
export async function loadStaffDirectory(options?: {
  force?: boolean;
  /** When false, skips role-catalog sync (faster background refresh). */
  syncRoles?: boolean;
}): Promise<User[]> {
  if (!options?.force) {
    const cached = getCrmWorkspaceList<User>(CRM_CACHE.staff);
    if (cached && cached.items.length > 0) return cached.items;
  }

  if (!options?.force && inFlight) return inFlight;

  inFlight = (async () => {
    const [staff, roles, assignments] = await Promise.all([
      listAgencyUsers(),
      listAgencyRoles(),
      listAgencyUserRoles(),
    ]);
    const enriched = enrichStaffWithRoles(staff, roles, assignments);
    setCrmWorkspaceList(CRM_CACHE.staff, enriched);
    const shouldSyncRoles = options?.syncRoles !== false;
    if (shouldSyncRoles && staff.length > 0 && staff[0].agencyId) {
      await syncAgencyRoleCatalog(staff[0].agencyId);
    }
    return enriched;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getCachedStaffDirectory(): User[] {
  return getCrmWorkspaceList<User>(CRM_CACHE.staff)?.items ?? [];
}

export function patchStaffUserRole(userId: string, role: string): void {
  patchCrmWorkspaceItem(CRM_CACHE.staff, userId, { role });
}

export function patchStaffUser(userId: string, patch: Partial<User>): void {
  patchCrmWorkspaceItem(CRM_CACHE.staff, userId, patch);
}

export function removeStaffUser(userId: string): void {
  removeCrmWorkspaceItem(CRM_CACHE.staff, userId);
}

export function invalidateStaffDirectoryCache(): void {
  invalidateCrmWorkspace(CRM_CACHE.staff);
}
