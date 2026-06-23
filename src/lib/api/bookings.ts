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
