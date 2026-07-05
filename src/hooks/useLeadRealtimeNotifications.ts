'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCrmToast } from '@/components/ui/CrmToastProvider';
import { invalidateCrmListCache } from '@/lib/api/crm-list-cache';
import { CRM_CACHE } from '@/lib/api/crm-workspace-store';
import {
  fetchRecentLeadEvents,
} from '@/lib/api/leads';
import {
  isLeadLocallyMutated,
  pruneLocalLeadMutations,
} from '@/lib/api/lead-local-mutations';
import { pushLeadNotification } from '@/lib/lead-notifications';

const POLL_MS = 4000;
const BOOTSTRAP_DELAY_MS = 800;

export const CRM_LEAD_INBOUND_EVENT = 'crm:lead-inbound';

function logPollError(error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[CRM lead notifications]', error);
  }
}

/** Poll for inbound leads and surface 3D toasts while the CRM dashboard is open. */
export function useLeadRealtimeNotifications(enabled: boolean) {
  const { showLeadToast } = useCrmToast();
  const router = useRouter();
  const showLeadToastRef = useRef(showLeadToast);
  const routerRef = useRef(router);
  const watermarkRef = useRef<string | null>(null);
  const bootstrappedRef = useRef(false);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  showLeadToastRef.current = showLeadToast;
  routerRef.current = router;

  useEffect(() => {
    if (!enabled) {
      bootstrappedRef.current = false;
      watermarkRef.current = null;
      seenEventKeysRef.current.clear();
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (cancelled || inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      inFlightRef.current = true;
      try {
        if (!bootstrappedRef.current) {
          bootstrappedRef.current = true;
          watermarkRef.current = new Date().toISOString();
          return;
        }

        const since = watermarkRef.current;
        if (!since) return;

        const events = await fetchRecentLeadEvents(since);
        if (cancelled) return;

        const fresh = events.filter((event) => {
          const key = `${event.id}:${event.updated_at}`;
          if (seenEventKeysRef.current.has(key)) return false;
          if (isLeadLocallyMutated(event.id)) return false;
          return true;
        });

        if (fresh.length > 0) {
          watermarkRef.current = fresh[0].updated_at;

          for (const event of [...fresh].reverse()) {
            seenEventKeysRef.current.add(`${event.id}:${event.updated_at}`);
            const notification = pushLeadNotification(event);
            showLeadToastRef.current({
              message: notification.message,
              kind: event.kind,
              durationMs: event.kind === 'new' ? 5200 : 4600,
              onAction: () => {
                routerRef.current.push(`/dashboard/crm?openLead=${event.id}`);
              },
            });
          }

          invalidateCrmListCache(CRM_CACHE.leads);
          window.dispatchEvent(new CustomEvent(CRM_LEAD_INBOUND_EVENT));
          pruneLocalLeadMutations();
        }
      } catch (error) {
        logPollError(error);
      } finally {
        inFlightRef.current = false;
      }
    };

    const bootstrapTimer = setTimeout(() => {
      void poll();
      intervalId = setInterval(() => void poll(), POLL_MS);
    }, BOOTSTRAP_DELAY_MS);

    const onVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(bootstrapTimer);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
