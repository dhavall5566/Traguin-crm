"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  type CrmSessionPayload,
  crmFetch,
  mapApiAgency,
  mapApiUser,
} from "@/lib/api/crm-client";
import { CRM_LOGIN_PATH } from "@/lib/auth";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authStatus = useStore((s) => s.authStatus);
  const currentUser = useStore((s) => s.currentUser);
  const hydrateSession = useStore((s) => s.hydrateSession);
  const clearAuthSession = useStore((s) => s.clearAuthSession);

  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/portal");

  useEffect(() => {
    if (!isProtectedRoute) return;
    void hydrateSession();
  }, [hydrateSession, isProtectedRoute]);

  useEffect(() => {
    if (!isProtectedRoute) {
      clearAuthSession();
    }
  }, [clearAuthSession, isProtectedRoute]);

  useEffect(() => {
    if (!isProtectedRoute || authStatus !== "unauthenticated" || currentUser) return;
    const next = encodeURIComponent(pathname);
    router.replace(`${CRM_LOGIN_PATH}?next=${next}`);
  }, [authStatus, currentUser, isProtectedRoute, pathname, router]);

  const showBlockingLoader =
    isProtectedRoute && authStatus === "loading" && !currentUser;

  if (showBlockingLoader) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export async function fetchSession(): Promise<CrmSessionPayload | null> {
  const response = await crmFetch("/api/crm/auth/session", { redirectOn401: false });
  if (!response.ok) return null;
  return (await response.json()) as CrmSessionPayload;
}

export function applySessionToStore(session: CrmSessionPayload): void {
  const { setSessionFromApi } = useStore.getState();
  setSessionFromApi(mapApiUser(session.user), mapApiAgency(session.agency));
}
