import { cookies } from "next/headers";
import type { CrmSessionPayload } from "@/lib/api/crm-client";
import { getCrmApiBaseUrl } from "@/lib/api/client";
import { CRM_SESSION_COOKIE } from "@/lib/auth";

export async function getServerCrmSession(): Promise<CrmSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CRM_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${getCrmApiBaseUrl()}/api/crm/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as CrmSessionPayload;
  } catch {
    return null;
  }
}
