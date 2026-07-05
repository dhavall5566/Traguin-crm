"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendLeadFollowup,
  appendLeadNote,
  applyLeadRecord,
  createLead,
  deleteLead as deleteLeadApi,
  getLead,
  loadLeadExtras,
  listLeads,
  mergeLeadExtras,
  patchLeadStatus,
  updateLead as updateLeadApi,
  type LeadCreateInput,
  type LeadExtras,
  type LeadRecord,
  type LeadUpdateInput,
} from "@/lib/api/leads";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import { markLeadLocallyMutated } from "@/lib/api/lead-local-mutations";
import { upsertCustomerInWorkspace } from "@/lib/api/customer-workspace-sync";
import type { Customer } from "@/lib/store";
import { CRM_LEAD_INBOUND_EVENT } from "@/hooks/useLeadRealtimeNotifications";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import {
  CRM_CACHE,
  getCrmWorkspaceList,
  patchCrmWorkspaceItem,
  prependCrmWorkspaceItem,
  removeCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import { listAgencyUsers, userNameMap } from "@/lib/api/users";
import type { Lead, LeadFollowup, LeadNote, User } from "@/lib/store";

function appendNoteToLead(
  leads: LeadRecord[],
  leadId: string,
  note: LeadNote,
): LeadRecord[] {
  return leads.map((lead) =>
    lead.id === leadId ? { ...lead, notes: [...lead.notes, note] } : lead,
  );
}

function removeNoteFromLead(
  leads: LeadRecord[],
  leadId: string,
  noteId: string,
): LeadRecord[] {
  return leads.map((lead) =>
    lead.id === leadId
      ? { ...lead, notes: lead.notes.filter((note) => note.id !== noteId) }
      : lead,
  );
}

function appendFollowupToLead(
  leads: LeadRecord[],
  leadId: string,
  followup: LeadFollowup,
): LeadRecord[] {
  return leads.map((lead) =>
    lead.id === leadId ? { ...lead, followups: [...lead.followups, followup] } : lead,
  );
}

function removeFollowupFromLead(
  leads: LeadRecord[],
  leadId: string,
  followupId: string,
): LeadRecord[] {
  return leads.map((lead) =>
    lead.id === leadId
      ? {
          ...lead,
          followups: lead.followups.filter((followup) => followup.id !== followupId),
        }
      : lead,
  );
}

export type OptimisticTimelineMutation<T = string | undefined> = {
  tempId: string;
  promise: Promise<T>;
};

function syncCustomersLinkedToLeads(leads: LeadRecord[]): void {
  const cached = getCrmWorkspaceList<Customer>(CRM_CACHE.customers);
  const cachedIds = new Set((cached?.items ?? []).map((row) => row.id));
  const missingCustomerIds = [
    ...new Set(
      leads
        .map((lead) => lead.customerId)
        .filter((id): id is string => Boolean(id) && !cachedIds.has(id)),
    ),
  ];
  for (const customerId of missingCustomerIds.slice(0, 25)) {
    void upsertCustomerInWorkspace(customerId).catch(() => undefined);
  }
}

export function useLeadsPage() {
  const warmLeads = getCrmWorkspaceList<LeadRecord>(CRM_CACHE.leads);
  const [leads, setLeads] = useState<LeadRecord[]>(() => warmLeads?.items ?? []);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(() => !warmLeads);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [hydratingLeadId, setHydratingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hydratedLeadIdsRef = useRef<Set<string>>(new Set());
  const userNameByIdRef = useRef<Record<string, string>>({});
  const leadMutationLockRef = useRef<Set<string>>(new Set());

  const userNameById = useMemo(() => userNameMap(staff), [staff]);
  userNameByIdRef.current = userNameById;

  const refreshLeads = useCallback(async () => {
    setError(null);
    invalidateCrmListCache(CRM_CACHE.leads);
    const extras = loadLeadExtras();
    hydratedLeadIdsRef.current.clear();
    const hasVisible = (getCrmWorkspaceList<LeadRecord>(CRM_CACHE.leads)?.items.length ?? 0) > 0;
    if (hasVisible) {
      setBackgroundLoading(true);
    } else {
      setLoading(true);
    }
    try {
      await loadProgressiveCrmList<
        Awaited<ReturnType<typeof listLeads>>["items"][number],
        LeadRecord
      >({
        cachePrefix: CRM_CACHE.leads,
        fetchPage: bindCrmListFetch(listLeads),
        mapItem: (item) => applyLeadRecord(item, userNameByIdRef.current, extras),
        force: true,
        onFirstPage: (firstItems) => {
          setLeads(firstItems);
          setLoading(false);
        },
        onComplete: (allItems) => {
          setLeads(allItems);
          setBackgroundLoading(false);
          syncCustomersLinkedToLeads(allItems);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const hasWarm = Boolean(getCrmWorkspaceList(CRM_CACHE.leads));
      if (!hasWarm) {
        setLoading(true);
      }
      setBackgroundLoading(false);
      setError(null);
      try {
        const extras = loadLeadExtras();
        const users = await listAgencyUsers();
        if (cancelled) return;

        setStaff(users);
        hydratedLeadIdsRef.current.clear();
        const names = userNameMap(users);
        userNameByIdRef.current = names;

        await loadProgressiveCrmList<
          Awaited<ReturnType<typeof listLeads>>["items"][number],
          LeadRecord
        >({
          cachePrefix: CRM_CACHE.leads,
          fetchPage: bindCrmListFetch(listLeads),
          mapItem: (item) => applyLeadRecord(item, names, extras),
          signal: controller.signal,
          onFirstPage: (firstItems, firstTotal) => {
            if (cancelled) return;
            setLeads(firstItems);
            setLoading(false);
            if (firstItems.length < firstTotal) setBackgroundLoading(true);
          },
          onComplete: (allItems) => {
            if (cancelled) return;
            setLeads(allItems);
            setBackgroundLoading(false);
            syncCustomersLinkedToLeads(allItems);
          },
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load leads");
          setLoading(false);
          setBackgroundLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const onInbound = () => {
      void refreshLeads();
    };
    window.addEventListener(CRM_LEAD_INBOUND_EVENT, onInbound);
    return () => window.removeEventListener(CRM_LEAD_INBOUND_EVENT, onInbound);
  }, [refreshLeads]);

  const replaceLeadInState = useCallback(
    (apiLead: Parameters<typeof applyLeadRecord>[0]) => {
      const extras = loadLeadExtras();
      const record = applyLeadRecord(apiLead, userNameByIdRef.current, extras);
      hydratedLeadIdsRef.current.add(record.id);
      setLeads((prev) => {
        const deduped = prev.filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
        const idx = deduped.findIndex((l) => l.id === record.id);
        if (idx === -1) return [record, ...deduped];
        const next = [...deduped];
        next[idx] = {
          ...record,
          customerId: record.customerId ?? deduped[idx].customerId,
          proposalItineraryId: record.proposalItineraryId ?? deduped[idx].proposalItineraryId,
        };
        return next;
      });
      return record;
    },
    [],
  );

  const hydrateLeadDetail = useCallback(async (leadId: string) => {
    if (!leadId || hydratedLeadIdsRef.current.has(leadId)) return;
    setHydratingLeadId(leadId);
    try {
      const apiLead = await getLead(leadId);
      replaceLeadInState(apiLead);
    } finally {
      setHydratingLeadId((current) => (current === leadId ? null : current));
    }
  }, [replaceLeadInState]);

  const updateLeadExtras = useCallback(
    (leadId: string, patch: LeadExtras) => {
      const next = mergeLeadExtras(leadId, patch);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                customerId: next[leadId]?.customerId ?? l.customerId,
                proposalItineraryId: next[leadId]?.proposalItineraryId ?? l.proposalItineraryId,
              }
            : l,
        ),
      );
    },
    [],
  );

  const addLead = useCallback(
    async (input: LeadCreateInput & { customerId?: string }) => {
      const lockKey = "create-lead";
      if (leadMutationLockRef.current.has(lockKey)) {
        return undefined;
      }
      leadMutationLockRef.current.add(lockKey);
      try {
        const { customerId, ...createInput } = input;
        const apiLead = await createLead(
          { ...createInput, customerId: customerId || undefined },
          {
            initialActivity: {
              type: "NOTE",
              description: `Lead created from source: ${createInput.source || "Manual Input"}`,
            },
          },
        );
        invalidateCrmListCache(CRM_CACHE.leads);
        replaceLeadInState(apiLead);
        markLeadLocallyMutated(apiLead.id);
        if (apiLead.customer_id) {
          await upsertCustomerInWorkspace(apiLead.customer_id);
        }
        return apiLead;
      } finally {
        leadMutationLockRef.current.delete(lockKey);
      }
    },
    [replaceLeadInState],
  );

  const updateLeadStatus = useCallback(
    async (leadId: string, status: Lead["status"]) => {
      const old = leads.find((l) => l.id === leadId);
      if (!old || old.status === status) return;

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status } : l)),
      );
      patchCrmWorkspaceItem(CRM_CACHE.leads, leadId, { status });

      try {
        const apiLead = await patchLeadStatus(leadId, status, old.status);
        replaceLeadInState(apiLead);
      } catch (error) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: old.status } : l)),
        );
        patchCrmWorkspaceItem(CRM_CACHE.leads, leadId, { status: old.status });
        throw error;
      }
    },
    [leads, replaceLeadInState],
  );

  const updateLead = useCallback(
    async (leadId: string, updates: LeadUpdateInput & LeadExtras) => {
      const { customerId, proposalItineraryId, ...scalar } = updates;
      if (customerId !== undefined || proposalItineraryId !== undefined) {
        updateLeadExtras(leadId, { customerId, proposalItineraryId });
      }
      const scalarKeys = Object.keys(scalar) as (keyof LeadUpdateInput)[];
      if (scalarKeys.length === 0) return;

      const snapshot = leads.find((l) => l.id === leadId);
      if (snapshot) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, ...scalar } : l)),
        );
        patchCrmWorkspaceItem(CRM_CACHE.leads, leadId, scalar);
      }

      try {
        const apiLead = await updateLeadApi(leadId, scalar);
        replaceLeadInState(apiLead);
      } catch (error) {
        if (snapshot) {
          setLeads((prev) =>
            prev.map((l) => (l.id === leadId ? snapshot : l)),
          );
          patchCrmWorkspaceItem(CRM_CACHE.leads, leadId, snapshot);
        }
        throw error;
      }
    },
    [leads, replaceLeadInState, updateLeadExtras],
  );

  const deleteLead = useCallback(async (leadId: string) => {
    const snapshot = leads.find((l) => l.id === leadId);
    hydratedLeadIdsRef.current.delete(leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    removeCrmWorkspaceItem(CRM_CACHE.leads, leadId);

    try {
      await deleteLeadApi(leadId);
      invalidateCrmListCache(CRM_CACHE.leads);
    } catch (error) {
      if (snapshot) {
        setLeads((prev) => [snapshot, ...prev]);
        prependCrmWorkspaceItem(CRM_CACHE.leads, snapshot);
      }
      throw error;
    }
  }, [leads]);

  const addLeadNote = useCallback(
    (leadId: string, content: string, createdBy: string): OptimisticTimelineMutation => {
      const trimmed = content.trim();
      if (!trimmed) {
        return { tempId: "", promise: Promise.resolve(undefined) };
      }

      const lockKey = `note:${leadId}`;
      if (leadMutationLockRef.current.has(lockKey)) {
        return { tempId: "", promise: Promise.resolve(undefined) };
      }
      leadMutationLockRef.current.add(lockKey);

      const tempId = `pending-note-${crypto.randomUUID()}`;
      const optimisticNote: LeadNote = {
        id: tempId,
        leadId,
        content: trimmed,
        createdBy,
        createdAt: new Date().toISOString(),
      };

      setLeads((prev) => appendNoteToLead(prev, leadId, optimisticNote));

      const promise = (async () => {
        try {
          const apiLead = await appendLeadNote(leadId, trimmed);
          replaceLeadInState(apiLead);
          const newest = [...apiLead.notes].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0];
          return newest?.id;
        } catch (error) {
          setLeads((prev) => removeNoteFromLead(prev, leadId, tempId));
          throw error;
        } finally {
          leadMutationLockRef.current.delete(lockKey);
        }
      })();

      return { tempId, promise };
    },
    [replaceLeadInState],
  );

  const addLeadFollowup = useCallback(
    (
      leadId: string,
      scheduledAt: string,
      notes: string,
      createdBy: string,
    ): OptimisticTimelineMutation => {
      const lockKey = `followup:${leadId}`;
      if (leadMutationLockRef.current.has(lockKey)) {
        return { tempId: "", promise: Promise.resolve(undefined) };
      }
      leadMutationLockRef.current.add(lockKey);

      const tempId = `pending-fup-${crypto.randomUUID()}`;
      const optimisticFollowup: LeadFollowup = {
        id: tempId,
        leadId,
        scheduledAt,
        status: "PENDING",
        notes,
        createdBy,
      };

      setLeads((prev) => appendFollowupToLead(prev, leadId, optimisticFollowup));

      const promise = (async () => {
        try {
          const apiLead = await appendLeadFollowup(leadId, { scheduledAt, notes });
          replaceLeadInState(apiLead);
          const newest = [...apiLead.followups].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0];
          return newest?.id;
        } catch (error) {
          setLeads((prev) => removeFollowupFromLead(prev, leadId, tempId));
          throw error;
        } finally {
          leadMutationLockRef.current.delete(lockKey);
        }
      })();

      return { tempId, promise };
    },
    [replaceLeadInState],
  );

  const leadNotes = useMemo(() => {
    const seen = new Set<string>();
    const merged: LeadRecord["notes"] = [];
    for (const lead of leads) {
      for (const note of lead.notes) {
        if (seen.has(note.id)) continue;
        seen.add(note.id);
        merged.push(note);
      }
    }
    return merged;
  }, [leads]);
  const leadActivities = useMemo(
    () => leads.flatMap((l) => l.activities),
    [leads],
  );
  const leadFollowups = useMemo(() => {
    const seen = new Set<string>();
    const merged: LeadRecord["followups"] = [];
    for (const lead of leads) {
      for (const followup of lead.followups) {
        if (seen.has(followup.id)) continue;
        seen.add(followup.id);
        merged.push(followup);
      }
    }
    return merged;
  }, [leads]);

  return {
    leads,
    staff,
    loading,
    backgroundLoading,
    hydratingLeadId,
    error,
    refreshLeads,
    hydrateLeadDetail,
    addLead,
    updateLeadStatus,
    updateLead,
    updateLeadExtras,
    deleteLead,
    addLeadNote,
    addLeadFollowup,
    leadNotes,
    leadActivities,
    leadFollowups,
  };
}
