import { crmFetchJson } from "@/lib/api/crm-client";
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

export function userNameMap(users: User[]): Record<string, string> {
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
}
