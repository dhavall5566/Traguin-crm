"use client";

import { useCallback, useEffect, useState } from "react";
import {
  acceptLeadAssignment,
  listPendingLeadAssignments,
  rejectLeadAssignment,
  type LeadAssignmentPending,
} from "@/lib/api/leads";
import { publishLeadAssignmentChange } from "@/lib/api/lead-assignment-sync";

const POLL_MS = 25_000;

export function usePendingLeadAssignments(enabled = true) {
  const [items, setItems] = useState<LeadAssignmentPending[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listPendingLeadAssignments();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assignment requests");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  const accept = useCallback(
    async (leadId: string) => {
      setActionId(leadId);
      try {
        const apiLead = await acceptLeadAssignment(leadId);
        publishLeadAssignmentChange(apiLead);
        await refresh();
      } finally {
        setActionId(null);
      }
    },
    [refresh],
  );

  const reject = useCallback(
    async (leadId: string) => {
      setActionId(leadId);
      try {
        const apiLead = await rejectLeadAssignment(leadId);
        publishLeadAssignmentChange(apiLead);
        await refresh();
      } finally {
        setActionId(null);
      }
    },
    [refresh],
  );

  return { items, loading, error, actionId, refresh, accept, reject };
}
