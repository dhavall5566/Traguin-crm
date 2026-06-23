"use client";

import { useLayoutEffect } from "react";
import type { CrmSessionPayload } from "@/lib/api/crm-client";
import { applySessionToStore } from "@/components/auth/SessionProvider";

type SessionBootstrapProps = {
  session: CrmSessionPayload | null;
};

export function SessionBootstrap({ session }: SessionBootstrapProps) {
  useLayoutEffect(() => {
    if (session) applySessionToStore(session);
  }, [session]);

  return null;
}
