'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Globe, Mail, Search, UserPlus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { canAccessModuleView } from '@/lib/rbac';
import { listAgencyUsers } from '@/lib/api/users';
import { useLeadMailSettings } from '@/hooks/useLeadMailSettings';
import { useClientPagination } from '@/hooks/useClientPagination';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmToggle } from '@/components/ui/CrmToggle';
import { crmToastError } from '@/lib/crm-toast-bus';
import type { User } from '@/lib/store';
import type { LeadMailEventType } from '@/lib/api/lead-mail-settings';

type EventDraft = {
  event_type: LeadMailEventType;
  enabled: boolean;
  recipient_user_ids: string[];
};

const EVENT_ORDER: LeadMailEventType[] = ['website_lead', 'crm_lead', 'status_change'];

const EVENT_META: Record<
  LeadMailEventType,
  { title: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  website_lead: {
    title: 'Website lead forms',
    description: 'Contact, planner, and other public forms that create CRM leads.',
    icon: Globe,
  },
  crm_lead: {
    title: 'CRM lead creation',
    description: 'Leads added manually from the CRM leads module.',
    icon: UserPlus,
  },
  status_change: {
    title: 'Lead status change',
    description: 'When a lead moves to a new pipeline stage inside CRM.',
    icon: ArrowRightLeft,
  },
};

function emptyEvents(): EventDraft[] {
  return EVENT_ORDER.map((event_type) => ({
    event_type,
    enabled: event_type !== 'status_change',
    recipient_user_ids: [],
  }));
}

export function SettingsEmailPanel() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const currentAgency = useStore((s) => s.currentAgency);
  const roleDefinitions = useStore((s) => s.roleDefinitions);

  const { settings, loading, error: loadError, saveEvent } = useLeadMailSettings();

  const [team, setTeam] = useState<User[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [events, setEvents] = useState<EventDraft[]>(emptyEvents);
  const [activeEvent, setActiveEvent] = useState<LeadMailEventType>('website_lead');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hydratingRef = useRef(true);
  const hydratedAgencyRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaveRef = useRef<{
    draft: EventDraft;
    previous?: EventDraft;
    patch: Partial<EventDraft>;
  } | null>(null);

  const canView = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'workspace_settings', roleDefinitions)
  );

  useEffect(() => {
    hydratedAgencyRef.current = null;
  }, [currentAgency.id]);

  useEffect(() => {
    if (!settings?.events?.length || loading) return;
    if (hydratedAgencyRef.current === currentAgency.id) return;
    hydratedAgencyRef.current = currentAgency.id;
    hydratingRef.current = true;
    setEvents(
      EVENT_ORDER.map((event_type) => {
        const match = settings.events.find((event) => event.event_type === event_type);
        return {
          event_type,
          enabled: match?.enabled ?? event_type !== 'status_change',
          recipient_user_ids: match?.recipient_user_ids ?? [],
        };
      }),
    );
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [settings, loading, currentAgency.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setTeamLoading(true);
      try {
        const users = await listAgencyUsers();
        if (!cancelled) setTeam(users.filter((user) => user.email?.trim()));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load team members');
        }
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAgency.id]);

  const activeDraft = useMemo(
    () => events.find((event) => event.event_type === activeEvent) ?? events[0],
    [events, activeEvent],
  );

  const selectedSet = useMemo(
    () => new Set(activeDraft?.recipient_user_ids ?? []),
    [activeDraft],
  );

  const filteredTeam = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return team;
    return team.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q),
    );
  }, [team, search]);

  const pagination = useClientPagination(filteredTeam, undefined, [search, activeEvent]);

  const activeMeta = EVENT_META[activeEvent];
  const eventEnabled = activeDraft?.enabled ?? false;

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persistEvent = async (
    draft: EventDraft,
    previous: EventDraft | undefined,
    patch: Partial<EventDraft>,
  ) => {
    try {
      setError(null);
      const payload: {
        event_type: LeadMailEventType;
        enabled?: boolean;
        recipient_user_ids?: string[];
      } = { event_type: draft.event_type };
      if ('enabled' in patch) payload.enabled = draft.enabled;
      if ('recipient_user_ids' in patch) payload.recipient_user_ids = draft.recipient_user_ids;
      await saveEvent(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save email configuration';
      setError(message);
      crmToastError(message);
      if (previous) {
        setEvents((prev) =>
          prev.map((event) => (event.event_type === previous.event_type ? previous : event)),
        );
      }
    }
  };

  const schedulePersist = (
    draft: EventDraft,
    previous: EventDraft | undefined,
    patch: Partial<EventDraft>,
  ) => {
    const prior = pendingSaveRef.current;
    pendingSaveRef.current = {
      draft,
      previous: prior?.previous ?? previous,
      patch: { ...prior?.patch, ...patch },
    };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;
      saveQueueRef.current = saveQueueRef.current
        .then(() => persistEvent(pending.draft, pending.previous, pending.patch))
        .catch(() => {
          /* persistEvent reports errors inline */
        });
    }, 600);
  };

  const applyEventChange = (eventType: LeadMailEventType, patch: Partial<EventDraft>) => {
    setEvents((prev) => {
      const previous = prev.find((event) => event.event_type === eventType);
      const next = prev.map((event) =>
        event.event_type === eventType ? { ...event, ...patch } : event,
      );
      const draft = next.find((event) => event.event_type === eventType);
      if (draft && !hydratingRef.current) {
        schedulePersist(draft, previous, patch);
      }
      return next;
    });
  };

  const toggleRecipient = (userId: string) => {
    if (!activeDraft) return;
    const next = new Set(activeDraft.recipient_user_ids);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    applyEventChange(activeEvent, { recipient_user_ids: [...next] });
  };

  const pageSelectedCount = pagination.pageItems.filter((user) => selectedSet.has(user.id)).length;
  const allPageSelected =
    pagination.pageItems.length > 0 && pageSelectedCount === pagination.pageItems.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;

  const toggleAllOnPage = () => {
    if (!activeDraft) return;
    const next = new Set(activeDraft.recipient_user_ids);
    if (allPageSelected) {
      pagination.pageItems.forEach((user) => next.delete(user.id));
    } else {
      pagination.pageItems.forEach((user) => next.add(user.id));
    }
    applyEventChange(activeEvent, { recipient_user_ids: [...next] });
  };

  if (currentUser && !canView) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-xs shadow-sm space-y-3">
        <h2 className="text-lg font-bold text-foreground">Email configuration</h2>
        <p className="text-muted-foreground leading-relaxed">
          Your role does not include access to workspace settings.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-primary px-4 py-2 text-[11px] font-semibold text-primary-foreground"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const displayError = error || loadError;

  return (
    <div className="space-y-4">
      {displayError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {displayError}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground">Lead email alerts</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Select an event on the left, then choose recipients on the right. Changes save
              automatically. Outbound delivery uses your workspace SMTP settings.
            </p>
          </div>
        </div>
      </section>

      <div className="crm-email-config">
        <aside className="crm-email-config__events" aria-label="Email alert events">
          {events.map((event) => {
            const meta = EVENT_META[event.event_type];
            const Icon = meta.icon;
            const isActive = activeEvent === event.event_type;
            return (
              <button
                key={event.event_type}
                type="button"
                className={`crm-email-config__event ${isActive ? 'crm-email-config__event--active' : ''}`}
                onClick={() => {
                  setActiveEvent(event.event_type);
                  setSearch('');
                }}
              >
                <span className="crm-email-config__event-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="crm-email-config__event-copy">
                  <span className="crm-email-config__event-title">{meta.title}</span>
                  <span className="crm-email-config__event-meta">
                    {event.enabled ? 'Enabled' : 'Disabled'} · {event.recipient_user_ids.length}{' '}
                    recipient{event.recipient_user_ids.length === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="crm-email-config__panel space-y-3">
          <div className="crm-email-config__panel-head">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">{activeMeta.title}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                {activeMeta.description}
              </p>
            </div>
            <CrmToggle
              id="crm-email-event-enabled"
              label="Enabled"
              checked={eventEnabled}
              onChange={(enabled) => applyEventChange(activeEvent, { enabled })}
            />
          </div>

          <div className="crm-email-config__toolbar">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="search"
                placeholder="Search users by name, email, or role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary/40 border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <span className="crm-email-config__count">
              {selectedSet.size} selected · {filteredTeam.length} user
              {filteredTeam.length === 1 ? '' : 's'}
            </span>
          </div>

          {!eventEnabled ? (
            <p className="text-[10px] text-muted-foreground">
              This event is disabled. Select recipients below, then turn on Enabled when you want
              emails to send.
            </p>
          ) : null}

          {eventEnabled && selectedSet.size === 0 ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              No recipients selected for this event — emails will not be sent until you choose at
              least one team member.
            </p>
          ) : null}

          {team.length === 0 && !teamLoading ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground">
              No team members with email addresses found. Add users under Team access first.
            </p>
          ) : (
            <CrmTablePanel>
              <div className="crm-table-wrap">
                {teamLoading ? (
                  <CrmTableSkeleton columns={4} rows={8} />
                ) : (
                  <div className="overflow-x-auto text-xs">
                    <table className="crm-data-table min-w-[560px]">
                      <thead>
                        <tr>
                          <th className="w-12">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border accent-primary"
                              checked={allPageSelected}
                              ref={(input) => {
                                if (input) input.indeterminate = somePageSelected;
                              }}
                              disabled={pagination.pageItems.length === 0}
                              onChange={toggleAllOnPage}
                              aria-label="Select all users on this page"
                            />
                          </th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagination.pageItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="crm-data-table__empty">
                              No users match your search.
                            </td>
                          </tr>
                        ) : (
                          pagination.pageItems.map((member) => {
                            const checked = selectedSet.has(member.id);
                            return (
                              <tr
                                key={member.id}
                                className={checked ? 'crm-data-table__row--selected' : undefined}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-border accent-primary"
                                    checked={checked}
                                    onChange={() => toggleRecipient(member.id)}
                                    aria-label={`Notify ${member.name}`}
                                  />
                                </td>
                                <td>
                                  <span className="truncate font-semibold text-foreground">
                                    {member.name}
                                  </span>
                                </td>
                                <td className="text-muted-foreground">{member.email}</td>
                                <td>
                                  <span className="crm-table-badge">{member.role}</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <CrmTablePagination
                label="Recipients"
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                hasPrev={pagination.hasPrev}
                hasNext={pagination.hasNext}
                onPrev={pagination.goPrev}
                onNext={pagination.goNext}
              />
            </CrmTablePanel>
          )}
        </section>
      </div>
    </div>
  );
}
