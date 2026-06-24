import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit, CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type ApiRole = {
  id: string;
  name: string;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiUserRole = {
  user_id: string;
  role_id: string;
};

let cachedApiRoles: ApiRole[] | null = null;
let cachedApiRolesAt = 0;
const API_ROLES_TTL_MS = 120_000;

export function invalidateAgencyRolesCache(): void {
  cachedApiRoles = null;
  cachedApiRolesAt = 0;
}

export async function getAgencyRolesCached(force = false): Promise<ApiRole[]> {
  if (
    !force &&
    cachedApiRoles &&
    Date.now() - cachedApiRolesAt < API_ROLES_TTL_MS
  ) {
    return cachedApiRoles;
  }
  cachedApiRoles = await listAgencyRoles();
  cachedApiRolesAt = Date.now();
  return cachedApiRoles;
}

export async function listAgencyRoles(): Promise<ApiRole[]> {
  const data = await crmFetchJson<PaginatedResponse<ApiRole>>(
    `/api/crm/rbac/roles?limit=${clampListLimit(CRM_API_DEFAULT_PAGE_SIZE)}`,
  );
  return data.items;
}

export async function createAgencyRole(name: string): Promise<ApiRole> {
  const created = await crmFetchJson<ApiRole>("/api/crm/rbac/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  invalidateAgencyRolesCache();
  return created;
}

export async function ensureAgencyRoleByName(name: string): Promise<ApiRole> {
  const trimmed = name.trim();
  const roles = await getAgencyRolesCached();
  const existing = roles.find((role) => role.name === trimmed);
  if (existing) return existing;
  return createAgencyRole(trimmed);
}

export async function listAgencyUserRoles(): Promise<ApiUserRole[]> {
  return crmFetchJson<ApiUserRole[]>("/api/crm/rbac/user-roles");
}

export async function listUserRoles(userId: string): Promise<ApiUserRole[]> {
  return crmFetchJson<ApiUserRole[]>(`/api/crm/rbac/users/${userId}/roles`);
}

export async function assignUserRole(userId: string, roleId: string): Promise<ApiUserRole> {
  return crmFetchJson<ApiUserRole>(`/api/crm/rbac/users/${userId}/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId }),
  });
}

export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  const response = await crmFetch(`/api/crm/rbac/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

/** Replace all API role links with a single named role. */
export async function setUserPrimaryRole(
  userId: string,
  roleName: string,
  roleId?: string,
): Promise<void> {
  let role: ApiRole | undefined;
  if (roleId) {
    const roles = await getAgencyRolesCached();
    role = roles.find((r) => r.id === roleId);
  }
  if (!role) {
    role = await ensureAgencyRoleByName(roleName);
  }
  const existing = await listUserRoles(userId);
  await Promise.all(existing.map((row) => removeUserRole(userId, row.role_id)));
  if (!existing.some((row) => row.role_id === role.id)) {
    await assignUserRole(userId, role.id);
  }
}
