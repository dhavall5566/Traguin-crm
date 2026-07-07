import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Itinerary, ItineraryDay, ItineraryItem } from "@/lib/store";

type ApiItineraryItem = {
  id: string;
  itinerary_day_id: string;
  type: string;
  title: string;
  details: unknown;
  cost_price: number | string;
  selling_price: number | string;
  order: number;
};

type ApiItineraryDay = {
  id: string;
  itinerary_id: string;
  day_number: number;
  title: string;
  description: string | null;
  items: ApiItineraryItem[];
};

export type ApiItineraryRead = {
  id: string;
  agency_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_id: string | null;
  status: Itinerary["status"];
  total_price: number | string;
  markup_margin: number | string;
  tax_rate: number | string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  days: ApiItineraryDay[];
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type ItineraryExtras = {
  proposalTheme?: Itinerary["proposalTheme"];
};

export type ItineraryCreateInput = Omit<
  Itinerary,
  "id" | "agencyId" | "days" | "proposalTheme"
> & {
  days?: ItineraryDay[];
};

export type ItineraryUpdateInput = Partial<
  Omit<Itinerary, "id" | "agencyId" | "days" | "proposalTheme">
> & {
  days?: ItineraryDay[];
};

const ITINERARY_EXTRAS_KEY = "travelcrm:itineraryExtras";

function detailsToFrontend(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw);
}

function detailsToApi(details: string | undefined): string | null {
  const trimmed = (details ?? "").trim();
  return trimmed || null;
}

export function computeItineraryTotalPrice(itin: Pick<Itinerary, "days" | "markupMargin" | "taxRate">): number {
  let baseCost = 0;
  for (const day of itin.days ?? []) {
    for (const item of day.items ?? []) {
      baseCost += Number(item.sellingPrice || 0);
    }
  }
  const markupMult = 1 + Number(itin.markupMargin || 0) / 100;
  const taxMult = 1 + Number(itin.taxRate || 0) / 100;
  return Number((baseCost * markupMult * taxMult).toFixed(2));
}

export function mapItemFromApi(item: ApiItineraryItem): ItineraryItem {
  return {
    id: item.id,
    type: item.type as ItineraryItem["type"],
    title: item.title,
    details: detailsToFrontend(item.details),
    costPrice: Number(item.cost_price),
    sellingPrice: Number(item.selling_price),
  };
}

export function mapDayFromApi(day: ApiItineraryDay): ItineraryDay {
  return {
    id: day.id,
    dayNumber: day.day_number,
    title: day.title,
    description: day.description ?? "",
    items: [...(day.items ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(mapItemFromApi),
  };
}

export function loadItineraryExtras(): Record<string, ItineraryExtras> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ITINERARY_EXTRAS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ItineraryExtras>;
  } catch {
    return {};
  }
}

export function saveItineraryExtras(extras: Record<string, ItineraryExtras>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ITINERARY_EXTRAS_KEY, JSON.stringify(extras));
  } catch {
    /* ignore */
  }
}

export function mergeItineraryExtras(
  itineraryId: string,
  patch: ItineraryExtras,
): Record<string, ItineraryExtras> {
  const all = loadItineraryExtras();
  all[itineraryId] = { ...all[itineraryId], ...patch };
  saveItineraryExtras(all);
  return all;
}

export type ApiItineraryListRead = Omit<ApiItineraryRead, "days">;

export function asFullItineraryRead(
  api: ApiItineraryListRead | ApiItineraryRead,
): ApiItineraryRead {
  return {
    ...api,
    days: "days" in api && Array.isArray(api.days) ? api.days : [],
  };
}

export function mapItineraryFromApi(
  api: ApiItineraryListRead | ApiItineraryRead,
  extras?: ItineraryExtras,
): Itinerary {
  const full = asFullItineraryRead(api);
  const days = [...(full.days ?? [])]
    .sort((a, b) => a.day_number - b.day_number)
    .map(mapDayFromApi);
  return {
    id: full.id,
    agencyId: full.agency_id,
    title: full.title,
    description: full.description ?? "",
    startDate: full.start_date ? full.start_date.slice(0, 10) : undefined,
    endDate: full.end_date ? full.end_date.slice(0, 10) : undefined,
    customerId: full.customer_id ?? undefined,
    status: full.status,
    totalPrice: Number(full.total_price),
    markupMargin: Number(full.markup_margin),
    taxRate: Number(full.tax_rate),
    isTemplate: full.is_template,
    days,
    proposalTheme: extras?.proposalTheme ?? "luxury",
  };
}

export function daysToApiPayload(days: ItineraryDay[]) {
  return days.map((day, dayIndex) => ({
    day_number: day.dayNumber ?? dayIndex + 1,
    title: day.title,
    description: day.description || null,
    items: (day.items ?? []).map((item, itemIndex) => ({
      type: item.type,
      title: item.title,
      details: detailsToApi(item.details),
      cost_price: Number(item.costPrice) || 0,
      selling_price: Number(item.sellingPrice) || 0,
      order: itemIndex,
    })),
  }));
}

function formatDateForApi(date?: string): string | null {
  if (!date?.trim()) return null;
  return date.includes("T") ? date : `${date}T00:00:00`;
}

function itineraryScalarsToApi(input: Partial<Itinerary>) {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description || null;
  if (input.startDate !== undefined) body.start_date = formatDateForApi(input.startDate);
  if (input.endDate !== undefined) body.end_date = formatDateForApi(input.endDate);
  if (input.customerId !== undefined) body.customer_id = input.customerId || null;
  if (input.status !== undefined) body.status = input.status;
  if (input.totalPrice !== undefined) body.total_price = input.totalPrice;
  if (input.markupMargin !== undefined) body.markup_margin = input.markupMargin;
  if (input.taxRate !== undefined) body.tax_rate = input.taxRate;
  if (input.isTemplate !== undefined) body.is_template = input.isTemplate;
  return body;
}

export async function listItineraries(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiItineraryListRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiItineraryListRead>>(
    `/api/crm/itineraries${qs ? `?${qs}` : ""}`,
  );
}

export async function getItinerary(id: string): Promise<ApiItineraryRead> {
  return crmFetchJson<ApiItineraryRead>(`/api/crm/itineraries/${id}`);
}

export async function createItineraryFromCmsPackage(input: {
  cmsPackageId: string;
  customerId?: string;
}): Promise<ApiItineraryRead> {
  return crmFetchJson<ApiItineraryRead>("/api/crm/itineraries/from-cms-package", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cms_package_id: input.cmsPackageId,
      customer_id: input.customerId ?? null,
    }),
  });
}

export async function createItinerary(input: ItineraryCreateInput): Promise<ApiItineraryRead> {
  const totalPrice = computeItineraryTotalPrice({
    days: input.days ?? [],
    markupMargin: input.markupMargin,
    taxRate: input.taxRate,
  });
  return crmFetchJson<ApiItineraryRead>("/api/crm/itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...itineraryScalarsToApi(input),
      title: input.title,
      description: input.description || null,
      status: input.status ?? "DRAFT",
      markup_margin: input.markupMargin ?? 0,
      tax_rate: input.taxRate ?? 0,
      is_template: input.isTemplate ?? false,
      total_price: totalPrice,
      days: daysToApiPayload(input.days ?? []),
    }),
  });
}

export async function updateItinerary(
  id: string,
  input: ItineraryUpdateInput,
): Promise<ApiItineraryRead> {
  const body = itineraryScalarsToApi(input);
  if (input.days !== undefined) {
    body.days = daysToApiPayload(input.days);
  }
  return crmFetchJson<ApiItineraryRead>(`/api/crm/itineraries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteItinerary(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/itineraries/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

export function applyItineraryRecord(
  api: ApiItineraryListRead | ApiItineraryRead,
  extrasMap: Record<string, ItineraryExtras>,
): Itinerary {
  return mapItineraryFromApi(api, extrasMap[api.id]);
}

export function newLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
