"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listAuditLogs, mapAuditLogFromApi, type ApiAuditLogRead } from "@/lib/api/audit-logs";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import { CRM_CACHE, getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { loadStaffDirectory } from "@/lib/api/staff-directory";
import { userNameMap } from "@/lib/api/users";
import { CRM_LEAD_INBOUND_EVENT } from "@/hooks/useLeadRealtimeNotifications";
import type { AuditLog } from "@/lib/store";

const AUDIT_POLL_MS = 25_000;

let auditLoadInFlight: Promise<void> | null = null;

function sortAuditLogs(items: AuditLog[]): AuditLog[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function isLeadAssignmentAuditLog(log: AuditLog): boolean {
  return (
    log.entityType === "Lead" &&
    (/accepted lead assignment/i.test(log.details) || /rejected lead assignment/i.test(log.details))
  );
}

async function loadAuditFeed(
  onUpdate: (items: AuditLog[]) => void,
  signal: AbortSignal,
  options?: { onAssignmentChange?: () => void; knownIds?: Set<string> },
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
        const sorted = sortAuditLogs(items);
        if (options?.knownIds) {
          const bootstrapComplete = options.knownIds.size > 0;
          const hasNewAssignment =
            bootstrapComplete &&
            options.onAssignmentChange &&
            sorted.some((log) => !options.knownIds!.has(log.id) && isLeadAssignmentAuditLog(log));
          sorted.forEach((log) => options.knownIds!.add(log.id));
          if (hasNewAssignment) options.onAssignmentChange!();
        }
        onUpdate(sorted);
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
  const knownAuditIdsRef = useRef<Set<string>>(
    new Set((cachedAudit?.items ?? []).map((log) => log.id)),
  );

  const refreshAuditLogs = useCallback(() => {
    invalidateCrmListCache(CRM_CACHE.auditLogs);
    const controller = new AbortController();
    void loadAuditFeed(
      (items) => {
        setAuditLogs(items);
      },
      controller.signal,
      {
        knownIds: knownAuditIdsRef.current,
        onAssignmentChange: () => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(CRM_LEAD_INBOUND_EVENT));
          }
        },
      },
    ).catch(() => {
      /* keep last known feed when refresh fails */
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    if (cachedAudit) {
      setAuditLogs(sortAuditLogs(cachedAudit.items));
      cachedAudit.items.forEach((log) => knownAuditIdsRef.current.add(log.id));
      setLoading(false);
    }

    void (async () => {
      if (!cachedAudit) setLoading(true);
      try {
        await loadAuditFeed(
          (items) => {
            if (!cancelled) {
              setAuditLogs(items);
              setLoading(false);
            }
          },
          controller.signal,
          {
            knownIds: knownAuditIdsRef.current,
            onAssignmentChange: () => {
              if (!cancelled && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent(CRM_LEAD_INBOUND_EVENT));
              }
            },
          },
        );
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

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener(CRM_LEAD_INBOUND_EVENT, refreshAuditLogs);
    return () => window.removeEventListener(CRM_LEAD_INBOUND_EVENT, refreshAuditLogs);
  }, [enabled, refreshAuditLogs]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => refreshAuditLogs(), AUDIT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refreshAuditLogs]);

  return { auditLogs, loading, refresh: refreshAuditLogs };
}
