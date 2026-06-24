"use client";

import { useEffect, useState } from "react";
import { listAuditLogs, mapAuditLogFromApi, type ApiAuditLogRead } from "@/lib/api/audit-logs";
import { CRM_CACHE, getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { loadStaffDirectory } from "@/lib/api/staff-directory";
import { userNameMap } from "@/lib/api/users";
import type { AuditLog } from "@/lib/store";

let auditLoadInFlight: Promise<void> | null = null;

function sortAuditLogs(items: AuditLog[]): AuditLog[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

async function loadAuditFeed(
  onUpdate: (items: AuditLog[]) => void,
  signal: AbortSignal,
): Promise<void> {
  if (auditLoadInFlight) {
    await auditLoadInFlight;
    const cached = getCrmWorkspaceList<AuditLog>(CRM_CACHE.auditLogs);
    if (cached) onUpdate(sortAuditLogs(cached.items));
    return;
  }

  auditLoadInFlight = (async () => {
    const staff = await loadStaffDirectory();
    if (signal.aborted) return;
    const names = userNameMap(staff);
    await loadProgressiveCrmList({
      cachePrefix: CRM_CACHE.auditLogs,
      fetchPage: bindCrmListFetch(listAuditLogs),
      mapItem: (item) => mapAuditLogFromApi(item as ApiAuditLogRead, names),
      signal,
      onFirstPage: (items) => {
        if (signal.aborted) return;
        onUpdate(sortAuditLogs(items));
      },
      onComplete: (items) => {
        if (signal.aborted) return;
        onUpdate(sortAuditLogs(items));
      },
    });
  })();

  try {
    await auditLoadInFlight;
  } finally {
    auditLoadInFlight = null;
  }
}

/** Recent audit entries for shell notifications and team access views. */
export function useAuditLogFeed(enabled = true) {
  const cachedAudit = getCrmWorkspaceList<AuditLog>(CRM_CACHE.auditLogs);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    cachedAudit ? sortAuditLogs(cachedAudit.items) : [],
  );
  const [loading, setLoading] = useState(enabled && !cachedAudit);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    if (cachedAudit) {
      setAuditLogs(sortAuditLogs(cachedAudit.items));
      setLoading(false);
    }

    void (async () => {
      if (!cachedAudit) setLoading(true);
      try {
        await loadAuditFeed((items) => {
          if (!cancelled) {
            setAuditLogs(items);
            setLoading(false);
          }
        }, controller.signal);
      } catch {
        if (!cancelled) {
          if (!cachedAudit) setAuditLogs([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- cache read once on mount

  return { auditLogs, loading };
}
