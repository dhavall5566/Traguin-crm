import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";

export type LeadMailEventType = "website_lead" | "crm_lead" | "status_change";

export type LeadMailRecipient = {
  user_id: string;
  name: string;
  email: string;
};

export type LeadMailEvent = {
  event_type: LeadMailEventType;
  enabled: boolean;
  recipient_user_ids: string[];
  recipients: LeadMailRecipient[];
};

export type AgencyLeadMailSettings = {
  events: LeadMailEvent[];
};

export type LeadMailEventInput = {
  event_type: LeadMailEventType;
  enabled?: boolean;
  recipient_user_ids?: string[];
};

export type AgencyLeadMailSettingsInput = {
  events: LeadMailEventInput[];
};

const EVENT_ORDER: LeadMailEventType[] = ["website_lead", "crm_lead", "status_change"];

type LegacyLeadMailSettings = {
  enabled?: boolean;
  recipient_user_ids?: string[];
  recipients?: LeadMailRecipient[];
};

function normalizeLeadMailSettings(data: AgencyLeadMailSettings | LegacyLeadMailSettings): AgencyLeadMailSettings {
  if ("events" in data && Array.isArray(data.events) && data.events.length > 0) {
    return data as AgencyLeadMailSettings;
  }

  const legacy = data as LegacyLeadMailSettings;
  const recipientUserIds = legacy.recipient_user_ids ?? [];
  const recipients = legacy.recipients ?? [];

  return {
    events: EVENT_ORDER.map((event_type) => ({
      event_type,
      enabled: event_type === "status_change" ? false : (legacy.enabled ?? true),
      recipient_user_ids: recipientUserIds,
      recipients,
    })),
  };
}

export async function fetchAgencyLeadMailSettings(): Promise<AgencyLeadMailSettings> {
  const data = await crmFetchJson<AgencyLeadMailSettings | LegacyLeadMailSettings>(
    "/api/crm/settings/lead-mail",
  );
  return normalizeLeadMailSettings(data);
}

export async function saveAgencyLeadMailSettings(
  payload: AgencyLeadMailSettingsInput,
): Promise<void> {
  const response = await crmFetch("/api/crm/settings/lead-mail", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}
