import { crmFetchJson } from "@/lib/api/crm-client";

export type InquiryLeadSummary = {
  id: string;
  lead_code: string | null;
  title: string;
  status: string;
  status_label: string;
  source: string | null;
  travel_destination: string | null;
  message?: string | null;
  value?: number | string | null;
  priority?: string | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingHistorySummary = {
  id: string;
  status: string;
  created_at: string;
  itinerary_title?: string | null;
};

export type CustomerFlag = {
  id: string;
  customer_id: string;
  remark: string;
  created_by_id: string;
  created_by_name: string | null;
  created_at: string;
};

export type CustomerInteraction = {
  id: string;
  type: 'inquiry' | 'note' | 'activity' | 'followup' | 'booking' | 'flag' | string;
  at: string;
  lead_id: string | null;
  lead_code: string | null;
  lead_title: string | null;
  author_name: string | null;
  title: string;
  content: string | null;
  activity_type: string | null;
  status_label: string | null;
};

export type CustomerInquiryHistory = {
  customer_id: string | null;
  customer_code: string | null;
  inquiry_number: number | null;
  total_inquiry_count: number;
  last_two_active_enquiries: InquiryLeadSummary[];
  past_not_converted: InquiryLeadSummary[];
  all_leads: InquiryLeadSummary[];
  bookings: BookingHistorySummary[];
  flags: CustomerFlag[];
  interactions: CustomerInteraction[];
  interaction_count?: number;
  booking_count?: number;
  flag_count?: number;
};

export type CustomerInquiryHistoryOptions = {
  includeInteractions?: boolean;
  includeDetails?: boolean;
};

function buildInquiryHistoryQuery(options: CustomerInquiryHistoryOptions): string {
  const params = new URLSearchParams();
  if (options.includeInteractions === false) {
    params.set('include_interactions', 'false');
  }
  if (options.includeDetails === false) {
    params.set('include_details', 'false');
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchLeadInquiryHistory(
  leadId: string,
  options: CustomerInquiryHistoryOptions = {},
): Promise<CustomerInquiryHistory> {
  const query = buildInquiryHistoryQuery(options);
  return crmFetchJson<CustomerInquiryHistory>(`/api/crm/leads/${leadId}/inquiry-history${query}`);
}

export async function fetchCustomerInquiryHistory(
  customerId: string,
  options: CustomerInquiryHistoryOptions = {},
): Promise<CustomerInquiryHistory> {
  const query = buildInquiryHistoryQuery(options);
  return crmFetchJson<CustomerInquiryHistory>(
    `/api/crm/customers/${customerId}/inquiry-history${query}`,
  );
}

export async function listCustomerFlags(customerId: string): Promise<CustomerFlag[]> {
  return crmFetchJson<CustomerFlag[]>(`/api/crm/customers/${customerId}/flags`);
}

export async function createCustomerFlag(customerId: string, remark: string): Promise<CustomerFlag> {
  return crmFetchJson<CustomerFlag>(`/api/crm/customers/${customerId}/flags`, {
    method: "POST",
    body: JSON.stringify({ remark }),
  });
}

export async function deleteCustomerFlag(customerId: string, flagId: string): Promise<void> {
  await crmFetchJson<void>(`/api/crm/customers/${customerId}/flags/${flagId}`, {
    method: "DELETE",
  });
}
