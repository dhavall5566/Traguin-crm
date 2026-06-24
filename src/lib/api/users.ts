import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { mapApiUser } from "@/lib/api/crm-client";
import { clampListLimit, CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import type { User } from "@/lib/store";

type ApiUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  agency_id: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export async function listAgencyUsers(): Promise<User[]> {
  const data = await crmFetchJson<PaginatedResponse<ApiUser>>(
    `/api/crm/users?limit=${clampListLimit(CRM_API_DEFAULT_PAGE_SIZE)}`,
  );
  return data.items.map((u) => mapApiUser(u));
}

export type AgencyUserCreateInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export async function createAgencyUser(input: AgencyUserCreateInput): Promise<User> {
  const api = await crmFetchJson<ApiUser>("/api/crm/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      phone: input.phone?.trim() || null,
    }),
  });
  return mapApiUser(api);
}

export type AgencyUserUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  password?: string;
};

export async function updateAgencyUser(
  userId: string,
  input: AgencyUserUpdateInput,
): Promise<User> {
  const body: Record<string, string | null> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.email !== undefined) body.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) body.phone = input.phone?.trim() || null;
  if (input.password) body.password = input.password;

  const api = await crmFetchJson<ApiUser>(`/api/crm/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return mapApiUser(api);
}

export async function deleteAgencyUser(userId: string): Promise<void> {
  const response = await crmFetch(`/api/crm/users/${userId}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

export function userNameMap(users: User[]): Record<string, string> {
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
}
