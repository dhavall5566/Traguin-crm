"use client";

import { useEffect, useState } from "react";
import { listAuditLogs, mapAuditLogFromApi, type ApiAuditLogRead } from "@/lib/api/audit-logs";
import { CRM_CACHE } from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { listAgencyUsers, userNameMap } from "@/lib/api/users";
import type { AuditLog } from "@/lib/store";

/** Recent audit entries for shell notifications and team access views. */
export function useAuditLogFeed(enabled = true) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      setLoading(true);
      try {
        const staff = await listAgencyUsers();
        const names = userNameMap(staff);
        await loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.auditLogs,
          fetchPage: bindCrmListFetch(listAuditLogs),
          mapItem: (item) => mapAuditLogFromApi(item as ApiAuditLogRead, names),
          signal: controller.signal,
          onFirstPage: (items) => {
            if (cancelled) return;
            setAuditLogs(
              [...items].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              ),
            );
            setLoading(false);
          },
          onComplete: (items) => {
            if (cancelled) return;
            setAuditLogs(
              [...items].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              ),
            );
            setLoading(false);
          },
        });
      } catch {
        if (!cancelled) {
          setAuditLogs([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  return { auditLogs, loading };
}
