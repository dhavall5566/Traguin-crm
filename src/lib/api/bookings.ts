import { crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Booking } from "@/lib/store";

export type ApiBookingRead = {
  id: string;
  agency_id: string;
  customer_id: string;
  itinerary_id: string | null;
  status: string;
  voucher_url: string | null;
  ticket_url: string | null;
  hotel_confirmation_code: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  visa_status: string | null;
  created_at: string;
  updated_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function mapBookingFromApi(api: ApiBookingRead): Booking {
  return {
    id: api.id,
    agencyId: api.agency_id,
    customerId: api.customer_id,
    itineraryId: api.itinerary_id ?? undefined,
    status: api.status as Booking["status"],
    voucherUrl: api.voucher_url ?? undefined,
    ticketUrl: api.ticket_url ?? undefined,
    hotelConfirmationCode: api.hotel_confirmation_code ?? undefined,
    driverName: api.driver_name ?? undefined,
    driverPhone: api.driver_phone ?? undefined,
    visaStatus: api.visa_status ?? undefined,
    createdAt: api.created_at,
  };
}

export async function listBookings(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiBookingRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiBookingRead>>(
    `/api/crm/bookings${qs ? `?${qs}` : ""}`,
  );
}

export type BookingCreateInput = {
  customerId: string;
  itineraryId?: string;
  status?: Booking["status"];
};

export async function createBooking(input: BookingCreateInput): Promise<ApiBookingRead> {
  return crmFetchJson<ApiBookingRead>("/api/crm/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: input.customerId,
      itinerary_id: input.itineraryId ?? null,
      status: input.status ?? "PENDING",
    }),
  });
}

export type BookingUpdateInput = {
  customerId?: string;
  itineraryId?: string | null;
  status?: Booking["status"];
  voucherUrl?: string | null;
  ticketUrl?: string | null;
  hotelConfirmationCode?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  visaStatus?: string | null;
};

export async function updateBooking(
  id: string,
  input: BookingUpdateInput,
): Promise<ApiBookingRead> {
  const body: Record<string, unknown> = {};
  if (input.customerId !== undefined) body.customer_id = input.customerId;
  if (input.itineraryId !== undefined) body.itinerary_id = input.itineraryId;
  if (input.status !== undefined) body.status = input.status;
  if (input.voucherUrl !== undefined) body.voucher_url = input.voucherUrl;
  if (input.ticketUrl !== undefined) body.ticket_url = input.ticketUrl;
  if (input.hotelConfirmationCode !== undefined) {
    body.hotel_confirmation_code = input.hotelConfirmationCode;
  }
  if (input.driverName !== undefined) body.driver_name = input.driverName;
  if (input.driverPhone !== undefined) body.driver_phone = input.driverPhone;
  if (input.visaStatus !== undefined) body.visa_status = input.visaStatus;

  return crmFetchJson<ApiBookingRead>(`/api/crm/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
