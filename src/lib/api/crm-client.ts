import type { Agency, User } from "@/lib/store";
import { CRM_LOGIN_PATH } from "@/lib/auth";

type ApiAgency = {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  subscription_plan: string;
};

type ApiUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  agency_id: string | null;
};

export type CrmSessionPayload = {
  user: ApiUser;
  agency: ApiAgency;
};

export function mapApiAgency(agency: ApiAgency): Agency {
  return {
    id: agency.id,
    name: agency.name,
    subdomain: agency.subdomain,
    logoUrl: agency.logo_url ?? undefined,
    primaryColor: agency.primary_color,
    secondaryColor: agency.secondary_color,
    subscriptionPlan: agency.subscription_plan,
  };
}

/** Role lives in UserRole/RBAC tables — default until server-side RBAC is wired. */
export function mapApiUser(user: ApiUser, role = "Agency Admin"): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? undefined,
    agencyId: user.agency_id ?? "",
    role,
  };
}

export async function crmFetch<T>(
  path: string,
  init?: RequestInit & { redirectOn401?: boolean },
): Promise<Response> {
  const { redirectOn401 = true, ...requestInit } = init ?? {};
  const response = await fetch(path, {
    ...requestInit,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...requestInit.headers,
    },
  });

  if (redirectOn401 && response.status === 401 && typeof window !== "undefined") {
    const loginUrl = new URL(CRM_LOGIN_PATH, window.location.origin);
    loginUrl.searchParams.set("next", window.location.pathname);
    window.location.href = loginUrl.toString();
  }

  return response;
}

export async function crmFetchJson<T>(
  path: string,
  init?: RequestInit & { redirectOn401?: boolean },
): Promise<T> {
  const response = await crmFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return (await response.json()) as T;
}
