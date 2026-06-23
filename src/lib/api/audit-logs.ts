import { crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { AuditLog } from "@/lib/store";

export type ApiAuditLogRead = {
  id: string;
  agency_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function mapAuditLogFromApi(
  api: ApiAuditLogRead,
  userNameById: Record<string, string>,
): AuditLog {
  return {
    id: api.id,
    agencyId: api.agency_id,
    userName: userNameById[api.user_id] ?? "Team member",
    action: api.action,
    entityType: api.entity_type,
    details: api.details ?? "",
    createdAt: api.created_at,
  };
}

export async function listAuditLogs(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  entityType?: string;
  action?: string;
}): Promise<PaginatedResponse<ApiAuditLogRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.userId) search.set("user_id", params.userId);
  if (params?.entityType) search.set("entity_type", params.entityType);
  if (params?.action) search.set("action", params.action);
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiAuditLogRead>>(
    `/api/crm/audit-logs${qs ? `?${qs}` : ""}`,
  );
}
