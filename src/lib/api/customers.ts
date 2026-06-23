import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Customer } from "@/lib/store";

type ApiCustomerDocument = {
  name: string;
  url?: string;
  category: string;
  size: string;
};

export type ApiCustomerRead = {
  id: string;
  agency_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  travel_history: unknown;
  documents: unknown;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CustomerCreateInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passportNumber?: string;
  passportExpiry?: string;
};

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

function normalizeTravelHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function normalizeDocuments(raw: unknown): Customer["documents"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is ApiCustomerDocument => typeof item === "object" && item !== null)
    .map((doc) => ({
      name: String(doc.name ?? ""),
      url: String(doc.url ?? "#"),
      category: String(doc.category ?? "Other"),
      size: String(doc.size ?? ""),
    }));
}

function formatPassportExpiryForApi(date?: string): string | null {
  if (!date?.trim()) return null;
  return date.includes("T") ? date : `${date}T00:00:00`;
}

function formatPassportExpiryFromApi(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

export function mapCustomerFromApi(api: ApiCustomerRead): Customer {
  return {
    id: api.id,
    agencyId: api.agency_id,
    firstName: api.first_name,
    lastName: api.last_name,
    email: api.email,
    phone: api.phone ?? undefined,
    passportNumber: api.passport_number ?? undefined,
    passportExpiry: formatPassportExpiryFromApi(api.passport_expiry),
    travelHistory: normalizeTravelHistory(api.travel_history),
    documents: normalizeDocuments(api.documents),
  };
}

function customerToApiCreateBody(input: CustomerCreateInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone || null,
    passport_number: input.passportNumber || null,
    passport_expiry: formatPassportExpiryForApi(input.passportExpiry),
    travel_history: [],
    documents: [],
  };
}

function customerToApiUpdateBody(input: CustomerUpdateInput) {
  const body: Record<string, unknown> = {};
  if (input.firstName !== undefined) body.first_name = input.firstName;
  if (input.lastName !== undefined) body.last_name = input.lastName;
  if (input.email !== undefined) body.email = input.email;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.passportNumber !== undefined) body.passport_number = input.passportNumber || null;
  if (input.passportExpiry !== undefined) {
    body.passport_expiry = formatPassportExpiryForApi(input.passportExpiry);
  }
  return body;
}

export function isEmailConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("email") && (msg.includes("already exists") || msg.includes("your agency"));
}

export async function listCustomers(params?: {
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}): Promise<PaginatedResponse<ApiCustomerRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.includeDeleted) search.set("include_deleted", "true");
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiCustomerRead>>(
    `/api/crm/customers${qs ? `?${qs}` : ""}`,
  );
}

export async function getCustomer(id: string): Promise<ApiCustomerRead> {
  return crmFetchJson<ApiCustomerRead>(`/api/crm/customers/${id}`);
}

export async function createCustomer(input: CustomerCreateInput): Promise<ApiCustomerRead> {
  return crmFetchJson<ApiCustomerRead>("/api/crm/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(customerToApiCreateBody(input)),
  });
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput & {
    documents?: Customer["documents"];
    travelHistory?: string[];
  },
): Promise<ApiCustomerRead> {
  const body = customerToApiUpdateBody(input);
  if (input.documents !== undefined) body.documents = input.documents;
  if (input.travelHistory !== undefined) body.travel_history = input.travelHistory;
  return crmFetchJson<ApiCustomerRead>(`/api/crm/customers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function appendCustomerDocument(
  id: string,
  doc: { name: string; category: string; size: string },
): Promise<ApiCustomerRead> {
  const current = await getCustomer(id);
  const existing = normalizeDocuments(current.documents);
  return updateCustomer(id, {
    documents: [
      ...existing,
      { name: doc.name, url: "#", category: doc.category, size: doc.size },
    ],
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/customers/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}
