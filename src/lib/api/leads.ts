import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Lead, LeadActivity, LeadFollowup, LeadNote } from "@/lib/store";

/** API snake_case shapes (CRM backend). */
type ApiLeadNote = {
  id: string;
  lead_id: string;
  content: string;
  created_by_id: string | null;
  created_at: string;
};

type ApiLeadActivity = {
  id: string;
  lead_id: string;
  type: string;
  description: string;
  created_by_id: string | null;
  created_at: string;
};

type ApiLeadFollowup = {
  id: string;
  lead_id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  created_by_id: string | null;
  created_at: string;
};

export type ApiLeadRead = {
  id: string;
  agency_id: string;
  title: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: Lead["status"];
  value: number;
  assigned_to_id: string | null;
  customer_id: string | null;
  proposal_sent_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  notes: ApiLeadNote[];
  activities: ApiLeadActivity[];
  followups: ApiLeadFollowup[];
};

export type ApiLeadListRead = Omit<ApiLeadRead, "notes" | "activities" | "followups">;

export function asFullLeadRead(lead: ApiLeadListRead | ApiLeadRead): ApiLeadRead {
  return {
    ...lead,
    notes: "notes" in lead && Array.isArray(lead.notes) ? lead.notes : [],
    activities: "activities" in lead && Array.isArray(lead.activities) ? lead.activities : [],
    followups: "followups" in lead && Array.isArray(lead.followups) ? lead.followups : [],
  };
}

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type LeadRecord = Lead & {
  notes: LeadNote[];
  activities: LeadActivity[];
  followups: LeadFollowup[];
};

export type LeadExtras = {
  customerId?: string;
  proposalItineraryId?: string;
};

export type LeadCreateInput = {
  title: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: Lead["status"];
  value?: number;
  assignedToId?: string;
  message?: string;
};

export type LeadUpdateInput = Partial<
  Pick<
    Lead,
    | "title"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "source"
    | "status"
    | "value"
    | "assignedToId"
    | "message"
  >
>;

const LEAD_EXTRAS_KEY = "travelcrm:leadExtras";

function resolveUserName(
  userId: string | null | undefined,
  userNameById: Record<string, string>,
): string {
  if (!userId) return "System";
  return userNameById[userId] ?? "Team member";
}

export function mapNoteFromApi(
  note: ApiLeadNote,
  userNameById: Record<string, string>,
): LeadNote {
  return {
    id: note.id,
    leadId: note.lead_id,
    content: note.content,
    createdBy: resolveUserName(note.created_by_id, userNameById),
    createdAt: note.created_at,
  };
}

export function mapActivityFromApi(
  activity: ApiLeadActivity,
  userNameById: Record<string, string>,
): LeadActivity {
  return {
    id: activity.id,
    leadId: activity.lead_id,
    type: activity.type as LeadActivity["type"],
    description: activity.description,
    createdBy: resolveUserName(activity.created_by_id, userNameById),
    createdAt: activity.created_at,
  };
}

export function mapFollowupFromApi(
  followup: ApiLeadFollowup,
  userNameById: Record<string, string>,
): LeadFollowup {
  return {
    id: followup.id,
    leadId: followup.lead_id,
    scheduledAt: followup.scheduled_at,
    status: followup.status as LeadFollowup["status"],
    notes: followup.notes ?? "",
    createdBy: resolveUserName(followup.created_by_id, userNameById),
  };
}

export function mapLeadFromApi(
  lead: ApiLeadRead,
  userNameById: Record<string, string>,
  extras?: LeadExtras,
): LeadRecord {
  return {
    id: lead.id,
    agencyId: lead.agency_id,
    title: lead.title,
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    source: lead.source ?? undefined,
    status: lead.status,
    value: lead.value,
    assignedToId: lead.assigned_to_id ?? undefined,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    customerId: lead.customer_id ?? extras?.customerId,
    proposalItineraryId: extras?.proposalItineraryId,
    proposalSentAt: lead.proposal_sent_at ?? undefined,
    message: lead.message ?? undefined,
    notes: lead.notes.map((n) => mapNoteFromApi(n, userNameById)),
    activities: lead.activities.map((a) => mapActivityFromApi(a, userNameById)),
    followups: lead.followups.map((f) => mapFollowupFromApi(f, userNameById)),
  };
}

function leadToApiCreateBody(input: LeadCreateInput) {
  return {
    title: input.title,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email || null,
    phone: input.phone || null,
    source: input.source || null,
    status: input.status ?? "NEW",
    value: input.value ?? 0,
    assigned_to_id: input.assignedToId || null,
    message: input.message?.trim() || null,
  };
}

function leadToApiUpdateBody(input: LeadUpdateInput) {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.firstName !== undefined) body.first_name = input.firstName;
  if (input.lastName !== undefined) body.last_name = input.lastName;
  if (input.email !== undefined) body.email = input.email || null;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.source !== undefined) body.source = input.source || null;
  if (input.status !== undefined) body.status = input.status;
  if (input.value !== undefined) body.value = input.value;
  if (input.assignedToId !== undefined) body.assigned_to_id = input.assignedToId || null;
  if (input.message !== undefined) body.message = input.message?.trim() || null;
  return body;
}

export function loadLeadExtras(): Record<string, LeadExtras> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(LEAD_EXTRAS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, LeadExtras>;
  } catch {
    return {};
  }
}

export function saveLeadExtras(extras: Record<string, LeadExtras>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LEAD_EXTRAS_KEY, JSON.stringify(extras));
  } catch {
    /* ignore quota */
  }
}

export function mergeLeadExtras(
  leadId: string,
  patch: LeadExtras,
): Record<string, LeadExtras> {
  const all = loadLeadExtras();
  all[leadId] = { ...all[leadId], ...patch };
  saveLeadExtras(all);
  return all;
}

export async function listLeads(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiLeadListRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiLeadListRead>>(
    `/api/crm/leads${qs ? `?${qs}` : ""}`,
  );
}

export async function listPendingLeadFollowups(): Promise<ApiLeadFollowup[]> {
  return crmFetchJson<ApiLeadFollowup[]>("/api/crm/leads/followups/pending");
}

export async function getLead(id: string): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`);
}

export async function createLead(
  input: LeadCreateInput,
  options?: {
    initialActivity?: { type: string; description: string };
  },
): Promise<ApiLeadRead> {
  const body: Record<string, unknown> = leadToApiCreateBody(input);
  if (options?.initialActivity) {
    body.activities = [
      {
        type: options.initialActivity.type,
        description: options.initialActivity.description,
      },
    ];
  }
  return crmFetchJson<ApiLeadRead>("/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateLead(
  id: string,
  input: LeadUpdateInput,
): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadToApiUpdateBody(input)),
  });
}

export async function patchLeadStatus(
  id: string,
  status: Lead["status"],
  previousStatus: Lead["status"],
): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      append_activities: [
        {
          type: "STAGE_CHANGE",
          description: `Moved stage from ${previousStatus} to ${status}`,
        },
      ],
    }),
  });
}

export async function appendLeadNote(
  id: string,
  content: string,
  options?: { logActivity?: boolean },
): Promise<ApiLeadRead> {
  const body: Record<string, unknown> = {
    append_notes: [{ content }],
  };
  if (options?.logActivity) {
    const preview =
      content.length > 40 ? `${content.substring(0, 40)}...` : content;
    body.append_activities = [
      { type: "NOTE", description: `Added note: "${preview}"` },
    ];
  }
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function appendLeadActivity(
  id: string,
  activity: { type: string; description: string },
): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ append_activities: [activity] }),
  });
}

export async function appendLeadFollowup(
  id: string,
  followup: { scheduledAt: string; notes: string; status?: string },
): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      append_followups: [
        {
          scheduled_at: followup.scheduledAt,
          notes: followup.notes,
          status: followup.status ?? "PENDING",
        },
      ],
    }),
  });
}

export async function deleteLead(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/leads/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

export function applyLeadRecord(
  apiLead: ApiLeadListRead | ApiLeadRead,
  userNameById: Record<string, string>,
  extrasMap: Record<string, LeadExtras>,
): LeadRecord {
  return mapLeadFromApi(asFullLeadRead(apiLead), userNameById, extrasMap[apiLead.id]);
}
