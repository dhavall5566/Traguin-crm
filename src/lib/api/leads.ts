import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import {
  leadDetailsToUpdateInput,
  pickLeadDetails,
  type LeadDetailsFields,
} from "@/lib/lead-details";
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
  lead_code: string | null;
  title: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: Lead["status"];
  value: number;
  assigned_to_id: string | null;
  assignment_status: string | null;
  assigned_by_id: string | null;
  priority: string | null;
  lead_category: string | null;
  customer_id: string | null;
  proposal_sent_at: string | null;
  message: string | null;
  travel_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  pincode: string | null;
  state: string | null;
  country: string | null;
  adults_count: number | null;
  children_count: number | null;
  children_ages: number[] | null;
  travel_type: string | null;
  arrival_date: string | null;
  hotel_category: string | null;
  meal_category: string | null;
  travel_destination: string | null;
  occasion: string | null;
  flight_type: string | null;
  extra_baggage: string | null;
  wheelchair_assistance: string | null;
  visa_assistance: string | null;
  travel_insurance: string | null;
  transportation: string | null;
  package_mode: string | null;
  cms_form_submission_id: string | null;
  cms_package_id: string | null;
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
  customerId?: string;
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
    | "priority"
    | "leadCategory"
    | "message"
    | "cmsPackageId"
    | keyof LeadDetailsFields
  >
>;

const LEAD_DETAIL_KEYS: (keyof LeadDetailsFields)[] = [
  "travelDate",
  "addressLine1",
  "addressLine2",
  "city",
  "pincode",
  "state",
  "country",
  "adultsCount",
  "childrenCount",
  "childrenAges",
  "travelType",
  "arrivalDate",
  "hotelCategory",
  "mealCategory",
  "travelDestination",
  "occasion",
  "flightType",
  "extraBaggage",
  "wheelchairAssistance",
  "visaAssistance",
  "travelInsurance",
  "transportation",
  "packageMode",
];

function mapDetailsFromApi(lead: ApiLeadRead): LeadDetailsFields {
  return pickLeadDetails({
    travelDate: lead.travel_date ?? undefined,
    addressLine1: lead.address_line1 ?? undefined,
    addressLine2: lead.address_line2 ?? undefined,
    city: lead.city ?? undefined,
    pincode: lead.pincode ?? undefined,
    state: lead.state ?? undefined,
    country: lead.country ?? undefined,
    adultsCount: lead.adults_count ?? undefined,
    childrenCount: lead.children_count ?? undefined,
    childrenAges: lead.children_ages ?? undefined,
    travelType: (lead.travel_type as LeadDetailsFields["travelType"]) ?? undefined,
    arrivalDate: lead.arrival_date ?? undefined,
    hotelCategory: (lead.hotel_category as LeadDetailsFields["hotelCategory"]) ?? undefined,
    mealCategory: (lead.meal_category as LeadDetailsFields["mealCategory"]) ?? undefined,
    travelDestination: lead.travel_destination ?? undefined,
    occasion: (lead.occasion as LeadDetailsFields["occasion"]) ?? undefined,
    flightType: (lead.flight_type as LeadDetailsFields["flightType"]) ?? undefined,
    extraBaggage: (lead.extra_baggage as LeadDetailsFields["extraBaggage"]) ?? undefined,
    wheelchairAssistance:
      (lead.wheelchair_assistance as LeadDetailsFields["wheelchairAssistance"]) ?? undefined,
    visaAssistance: (lead.visa_assistance as LeadDetailsFields["visaAssistance"]) ?? undefined,
    travelInsurance: (lead.travel_insurance as LeadDetailsFields["travelInsurance"]) ?? undefined,
    transportation: (lead.transportation as LeadDetailsFields["transportation"]) ?? undefined,
    packageMode: (lead.package_mode as LeadDetailsFields["packageMode"]) ?? undefined,
  });
}

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
    leadCode: lead.lead_code ?? undefined,
    title: lead.title,
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    source: lead.source ?? undefined,
    status: lead.status,
    value: lead.value,
    assignedToId: lead.assigned_to_id ?? undefined,
    assignmentStatus: (lead.assignment_status as Lead['assignmentStatus']) ?? undefined,
    assignedById: lead.assigned_by_id ?? undefined,
    priority: (lead.priority as Lead["priority"]) ?? undefined,
    leadCategory: (lead.lead_category as Lead["leadCategory"]) ?? undefined,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    customerId: lead.customer_id ?? extras?.customerId,
    proposalItineraryId: extras?.proposalItineraryId,
    proposalSentAt: lead.proposal_sent_at ?? undefined,
    message: lead.message ?? undefined,
    cmsFormSubmissionId: lead.cms_form_submission_id ?? undefined,
    cmsPackageId: lead.cms_package_id ?? undefined,
    ...mapDetailsFromApi(lead),
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
    customer_id: input.customerId || null,
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
  if (input.priority !== undefined) body.priority = input.priority || null;
  if (input.leadCategory !== undefined) body.lead_category = input.leadCategory || null;
  if (input.message !== undefined) body.message = input.message?.trim() || null;
  if (input.cmsPackageId !== undefined) body.cms_package_id = input.cmsPackageId || null;
  if (LEAD_DETAIL_KEYS.some((key) => key in input)) {
    Object.assign(body, leadDetailsToUpdateInput(pickLeadDetails(input)));
  }
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

export type ApiLeadRecentEvent = {
  id: string;
  lead_code: string | null;
  title: string;
  first_name: string;
  last_name: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  kind: "new" | "returning";
  existing_customer?: boolean;
  customer_id?: string | null;
  merged_duplicate?: boolean;
  match_reason?: string | null;
};

export type LeadIntakeDuplicate = {
  id: string;
  lead_code: string | null;
  title: string;
  status: Lead["status"];
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type LeadIntakeCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

export type LeadIntakeCheckResult = {
  existing_customer: LeadIntakeCustomer | null;
  canonical_lead: LeadIntakeDuplicate | null;
  match_reason: string | null;
  duplicate_leads: LeadIntakeDuplicate[];
  will_merge: boolean;
};

export type LeadCreateResult = {
  lead: ApiLeadRead;
  merged: boolean;
};

export async function fetchRecentLeadEvents(since: string): Promise<ApiLeadRecentEvent[]> {
  const qs = new URLSearchParams();
  qs.set('since', since);
  return crmFetchJson<ApiLeadRecentEvent[]>(`/api/crm/leads/recent?${qs.toString()}`);
}

export async function getLead(id: string): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${id}`);
}

export async function checkLeadIntake(params: {
  email?: string;
  phone?: string;
  excludeLeadId?: string;
}): Promise<LeadIntakeCheckResult> {
  const qs = new URLSearchParams();
  if (params.email?.trim()) qs.set("email", params.email.trim());
  if (params.phone?.trim()) qs.set("phone", params.phone.trim());
  if (params.excludeLeadId) qs.set("exclude_lead_id", params.excludeLeadId);
  return crmFetchJson<LeadIntakeCheckResult>(`/api/crm/leads/intake-check?${qs.toString()}`);
}

export async function createLead(
  input: LeadCreateInput,
  options?: {
    initialActivity?: { type: string; description: string };
  },
): Promise<LeadCreateResult> {
  const body: Record<string, unknown> = leadToApiCreateBody(input);
  if (options?.initialActivity) {
    body.activities = [
      {
        type: options.initialActivity.type,
        description: options.initialActivity.description,
      },
    ];
  }
  const response = await crmFetch("/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    let detail: string | undefined;
    if (typeof errBody?.detail === "string") {
      detail = errBody.detail;
    }
    throw new Error(detail ?? `Request failed (${response.status})`);
  }
  const text = await response.text();
  const lead = JSON.parse(text) as ApiLeadRead;
  return { lead, merged: response.status === 200 };
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

export type ApiLeadAssignmentPending = {
  id: string;
  lead_code: string | null;
  title: string;
  first_name: string;
  last_name: string;
  source: string | null;
  phone: string | null;
  assigned_by_id: string | null;
  assigned_by_name: string | null;
  updated_at: string;
};

export type LeadAssignmentPending = {
  id: string;
  leadCode?: string;
  title: string;
  firstName: string;
  lastName: string;
  source?: string;
  phone?: string;
  assignedById?: string;
  assignedByName?: string;
  updatedAt: string;
};

export function mapPendingAssignmentFromApi(row: ApiLeadAssignmentPending): LeadAssignmentPending {
  return {
    id: row.id,
    leadCode: row.lead_code ?? undefined,
    title: row.title,
    firstName: row.first_name,
    lastName: row.last_name,
    source: row.source ?? undefined,
    phone: row.phone ?? undefined,
    assignedById: row.assigned_by_id ?? undefined,
    assignedByName: row.assigned_by_name ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function listPendingLeadAssignments(): Promise<LeadAssignmentPending[]> {
  const rows = await crmFetchJson<ApiLeadAssignmentPending[]>("/api/crm/leads/assignments/pending");
  return rows.map(mapPendingAssignmentFromApi);
}

export async function acceptLeadAssignment(leadId: string): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${leadId}/assignment/accept`, {
    method: "POST",
  });
}

export async function rejectLeadAssignment(leadId: string): Promise<ApiLeadRead> {
  return crmFetchJson<ApiLeadRead>(`/api/crm/leads/${leadId}/assignment/reject`, {
    method: "POST",
  });
}
