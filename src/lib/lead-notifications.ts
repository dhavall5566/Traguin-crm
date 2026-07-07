'use client';

import { useEffect, useState } from 'react';
import type { ApiLeadRecentEvent } from '@/lib/api/leads';
import { formatLeadDisplayCode } from '@/lib/lead-codes';

export type LeadNotificationItem = {
  id: string;
  leadId: string;
  message: string;
  kind: 'new' | 'returning';
  createdAt: string;
};

const MAX_ITEMS = 24;
const listeners = new Set<() => void>();
let leadNotifications: LeadNotificationItem[] = [];

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function formatLeadNotificationMessage(event: ApiLeadRecentEvent): string {
  const code = formatLeadDisplayCode({
    leadCode: event.lead_code ?? undefined,
    id: event.id,
  });
  const name = `${event.first_name} ${event.last_name}`.trim();
  const source = event.source?.trim();

  if (event.kind === 'new') {
    if (event.existing_customer) {
      return source
        ? `New lead ${code} — returning customer ${name} via ${source}`
        : `New lead ${code} — returning customer ${name}`;
    }
    return source
      ? `New lead ${code} — ${name} via ${source}`
      : `New lead ${code} — ${name}`;
  }

  if (event.merged_duplicate) {
    return source
      ? `Duplicate inquiry merged into ${code} — ${name} (${source})`
      : `Duplicate inquiry merged into ${code} — ${name}`;
  }

  return source
    ? `Returning contact ${code} — ${name} (${source})`
    : `Returning contact ${code} — ${name}`;
}

export function pushLeadNotification(event: ApiLeadRecentEvent): LeadNotificationItem {
  const item: LeadNotificationItem = {
    id: `${event.id}:${event.updated_at}`,
    leadId: event.id,
    message: formatLeadNotificationMessage(event),
    kind: event.kind,
    createdAt: event.updated_at,
  };

  leadNotifications = [
    item,
    ...leadNotifications.filter((existing) => existing.id !== item.id),
  ].slice(0, MAX_ITEMS);

  notifyListeners();
  return item;
}

export function getLeadNotifications(): LeadNotificationItem[] {
  return leadNotifications;
}

export function useLeadNotifications(): LeadNotificationItem[] {
  const [, tick] = useState(0);

  useEffect(() => {
    const listener = () => tick((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return leadNotifications;
}
