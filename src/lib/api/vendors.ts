import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Vendor } from "@/lib/store";

type ApiVendorRate = {
  id: string;
  vendor_service_id: string | null;
  vendor_package_id: string | null;
  rate: number | string;
  season_start: string;
  season_end: string;
};

type ApiVendorService = {
  id: string;
  vendor_id: string;
  type: string;
  name: string;
  description: string | null;
  base_rate: number | string;
  rates: ApiVendorRate[];
};

type ApiVendorPackage = {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number | string;
  rates: ApiVendorRate[];
};

export type ApiVendorRead = {
  id: string;
  agency_id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ledger_balance: number | string;
  created_at: string;
  updated_at: string;
  services: ApiVendorService[];
  packages: ApiVendorPackage[];
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type VendorFlatRate = Vendor["rates"][number];

export type VendorCreateInput = Omit<Vendor, "id" | "agencyId" | "ledgerBalance">;
export type VendorUpdateInput = Partial<Omit<Vendor, "id" | "agencyId">>;

/** Flat UI rates ↔ nested API services/packages */
export function flatRatesFromApi(api: ApiVendorRead): VendorFlatRate[] {
  const type = (api.type ?? "SERVICE").toUpperCase();
  if (type === "PACKAGE") {
    return (api.packages ?? []).map((pkg) => ({
      name: pkg.name,
      type: "PACKAGE",
      price: Number(pkg.price),
    }));
  }
  return (api.services ?? []).map((svc) => ({
    name: svc.name,
    type: svc.type,
    price: Number(svc.base_rate),
  }));
}

export function nestedPayloadFromFlatRates(
  vendorType: Vendor["type"],
  rates: VendorFlatRate[],
): { services?: Record<string, unknown>[]; packages?: Record<string, unknown>[] } {
  if (vendorType === "PACKAGE") {
    return {
      packages: rates.map((r) => ({
        name: r.name,
        description: null,
        price: Number(r.price) || 0,
        rates: [],
      })),
    };
  }
  return {
    services: rates.map((r) => ({
      type: r.type,
      name: r.name,
      description: null,
      base_rate: Number(r.price) || 0,
      rates: [],
    })),
  };
}

export type ApiVendorListRead = Omit<ApiVendorRead, "services" | "packages">;

export function asFullVendorRead(vendor: ApiVendorListRead | ApiVendorRead): ApiVendorRead {
  return {
    ...vendor,
    services: "services" in vendor && Array.isArray(vendor.services) ? vendor.services : [],
    packages: "packages" in vendor && Array.isArray(vendor.packages) ? vendor.packages : [],
  };
}

export function mapVendorFromApi(api: ApiVendorListRead | ApiVendorRead): Vendor {
  const full = asFullVendorRead(api);
  return {
    id: api.id,
    agencyId: api.agency_id,
    name: api.name,
    type: (api.type?.toUpperCase() === "PACKAGE" ? "PACKAGE" : "SERVICE") as Vendor["type"],
    email: api.email ?? "",
    phone: api.phone ?? "",
    address: api.address ?? "",
    ledgerBalance: Number(api.ledger_balance),
    rates: flatRatesFromApi(full),
  };
}

function vendorScalarsToApi(input: Partial<Vendor>) {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.type !== undefined) body.type = input.type;
  if (input.email !== undefined) body.email = input.email || null;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.address !== undefined) body.address = input.address || null;
  if (input.ledgerBalance !== undefined) body.ledger_balance = input.ledgerBalance;
  return body;
}

export async function listVendors(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiVendorListRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiVendorListRead>>(
    `/api/crm/vendors${qs ? `?${qs}` : ""}`,
  );
}

export async function getVendor(id: string): Promise<ApiVendorRead> {
  return crmFetchJson<ApiVendorRead>(`/api/crm/vendors/${id}`);
}

export async function createVendor(input: VendorCreateInput): Promise<ApiVendorRead> {
  const nested = nestedPayloadFromFlatRates(input.type, input.rates ?? []);
  return crmFetchJson<ApiVendorRead>("/api/crm/vendors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      type: input.type,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      ledger_balance: 0,
      services: nested.services ?? [],
      packages: nested.packages ?? [],
    }),
  });
}

export async function updateVendor(id: string, input: VendorUpdateInput): Promise<ApiVendorRead> {
  const body = vendorScalarsToApi(input);
  if (input.rates !== undefined && input.type !== undefined) {
    Object.assign(body, nestedPayloadFromFlatRates(input.type, input.rates));
  } else if (input.rates !== undefined) {
    const current = await getVendor(id);
    const vendorType = (input.type ??
      (current.type?.toUpperCase() === "PACKAGE" ? "PACKAGE" : "SERVICE")) as Vendor["type"];
    Object.assign(body, nestedPayloadFromFlatRates(vendorType, input.rates));
  }
  return crmFetchJson<ApiVendorRead>(`/api/crm/vendors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteVendor(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/vendors/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === "string" ? payload.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}
