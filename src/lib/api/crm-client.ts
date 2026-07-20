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

export const CRM_FETCH_TIMEOUT_MS = 30_000;

type CrmFetchInit = RequestInit & {
  redirectOn401?: boolean;
  timeoutMs?: number;
};

export async function crmFetch(path: string, init?: CrmFetchInit): Promise<Response> {
  const { redirectOn401 = true, timeoutMs = CRM_FETCH_TIMEOUT_MS, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timer =
    typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const response = await fetch(path, {
      ...requestInit,
      signal: controller.signal,
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Check that the CRM API is running.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Unable to reach the CRM API. Start the backend on port 8001 and refresh the page.",
      );
    }
    throw error;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

export async function crmFetchJson<T>(
  path: string,
  init?: RequestInit & { redirectOn401?: boolean },
): Promise<T> {
  const response = await crmFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    let detail: string | undefined;
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (Array.isArray(body?.detail)) {
      detail = body.detail
        .map((item: { msg?: string; loc?: unknown[] }) => {
          const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
          return field ? `${field}: ${item.msg ?? "Invalid value"}` : item.msg ?? "Invalid value";
        })
        .join("; ");
    }
    throw new Error(detail ?? `Request failed (${response.status})`);
  }
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
