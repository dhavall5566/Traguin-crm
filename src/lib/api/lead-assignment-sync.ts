import { applyLeadRecord, loadLeadExtras, type ApiLeadRead } from "@/lib/api/leads";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import { patchCrmWorkspaceItem, CRM_CACHE } from "@/lib/api/crm-workspace-store";
import { CRM_LEAD_INBOUND_EVENT } from "@/hooks/useLeadRealtimeNotifications";

/** Push accept/reject result into workspace cache and notify open CRM views. */
export function publishLeadAssignmentChange(apiLead: ApiLeadRead): void {
  const extras = loadLeadExtras();
  const record = applyLeadRecord(apiLead, {}, extras);
  patchCrmWorkspaceItem(CRM_CACHE.leads, record.id, {
    assignedToId: record.assignedToId,
    assignmentStatus: record.assignmentStatus,
    assignedById: record.assignedById,
    updatedAt: record.updatedAt,
    activities: record.activities,
  });
  invalidateCrmListCache(CRM_CACHE.leads);
  invalidateCrmListCache(CRM_CACHE.auditLogs);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRM_LEAD_INBOUND_EVENT));
  }
}
