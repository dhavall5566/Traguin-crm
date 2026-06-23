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
import { CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
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

export function useLeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydratingLeadId, setHydratingLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extrasMap, setExtrasMap] = useState<Record<string, LeadExtras>>({});
  const hydratedLeadIdsRef = useRef<Set<string>>(new Set());
  const userNameByIdRef = useRef<Record<string, string>>({});
  const leadMutationLockRef = useRef<Set<string>>(new Set());

  const userNameById = useMemo(() => userNameMap(staff), [staff]);
  userNameByIdRef.current = userNameById;

  const mapLeadItems = useCallback(
    (
      items: Awaited<ReturnType<typeof listLeads>>["items"],
      names: Record<string, string>,
      extras: Record<string, LeadExtras>,
    ) => items.map((item) => applyLeadRecord(item, names, extras)),
    [],
  );

  const refreshLeads = useCallback(async () => {
    setError(null);
    const extras = loadLeadExtras();
    setExtrasMap(extras);
    hydratedLeadIdsRef.current.clear();
    const data = await listLeads({ limit: CRM_API_DEFAULT_PAGE_SIZE });
    const names = userNameByIdRef.current;
    setLeads(mapLeadItems(data.items, names, extras));
  }, [mapLeadItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const extras = loadLeadExtras();
        const [users, data] = await Promise.all([
          listAgencyUsers(),
          listLeads({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setStaff(users);
        setExtrasMap(extras);
        hydratedLeadIdsRef.current.clear();
        const names = userNameMap(users);
        userNameByIdRef.current = names;
        setLeads(mapLeadItems(data.items, names, extras));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load leads");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapLeadItems]);

  const replaceLeadInState = useCallback(
    (apiLead: Parameters<typeof applyLeadRecord>[0]) => {
      const extras = loadLeadExtras();
      setExtrasMap(extras);
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
      setExtrasMap(next);
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
      const { customerId: _ignored, ...createInput } = input;
      const apiLead = await createLead(createInput, {
        initialActivity: {
          type: "NOTE",
          description: `Lead created from source: ${createInput.source || "Manual Input"}`,
        },
      });
      replaceLeadInState(apiLead);
    },
    [replaceLeadInState],
  );

  const updateLeadStatus = useCallback(
    async (leadId: string, status: Lead["status"]) => {
      const old = leads.find((l) => l.id === leadId);
      if (!old || old.status === status) return;
      const apiLead = await patchLeadStatus(leadId, status, old.status);
      replaceLeadInState(apiLead);
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
      if (scalarKeys.length > 0) {
        const apiLead = await updateLeadApi(leadId, scalar);
        replaceLeadInState(apiLead);
      }
    },
    [replaceLeadInState, updateLeadExtras],
  );

  const deleteLead = useCallback(async (leadId: string) => {
    await deleteLeadApi(leadId);
    hydratedLeadIdsRef.current.delete(leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

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
