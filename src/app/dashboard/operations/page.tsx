'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useOperationsPage } from '@/hooks/useOperationsPage';
import {
  addDays,
  formatYMD,
  startOfIsoWeek,
  type OpsCalendarEvent,
  type StuckProposalLeadRow,
  type UntouchedStaleLeadRow,
} from '@/lib/weekly-ops-logic';
import type { Lead, User } from '@/lib/store';
import {
  AlarmClock,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  IndianRupee,
  PhoneOutgoing,
  Plane,
  Users,
} from 'lucide-react';

function kindBadge(kind: OpsCalendarEvent['kind']) {
  switch (kind) {
    case 'departure':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Departure
        </span>
      );
    case 'follow_up':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
          Follow-up
        </span>
      );
    default:
      return (
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Payment
        </span>
      );
  }
}

export default function OperationsPage() {
  const [mounted, setMounted] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [slaNow, setSlaNow] = useState<Date | null>(null);

  const weekStart = useMemo(() => startOfIsoWeek(cursor), [cursor]);
  const weekEndDisplay = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const { loading, error, users, calendarEvents, untouched24, proposals7 } = useOperationsPage(
    weekStart,
    slaNow,
  );

  useEffect(() => {
    setMounted(true);
    setSlaNow(new Date());
  }, []);

  const groupedByDay = useMemo(() => {
    const map: Record<string, OpsCalendarEvent[]> = {};
    calendarEvents.forEach((e) => {
      if (!map[e.dateKey]) map[e.dateKey] = [];
      map[e.dateKey].push(e);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const o = ['departure', 'follow_up', 'payment_due'] as const;
        return o.indexOf(a.kind) - o.indexOf(b.kind);
      }),
    );
    return map;
  }, [calendarEvents]);

  const daysAxis = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekDayKeys = useMemo(() => daysAxis.map((d) => formatYMD(d)), [daysAxis]);
  const todayYmd = formatYMD(new Date());

  /** User-picked day in the strip; falls back to today-in-week or Monday of the visible week. */
  const [pickedDayKey, setPickedDayKey] = useState<string | null>(null);
  const activeDayKey = useMemo(() => {
    const inWeek = (k: string) => weekDayKeys.includes(k);
    if (pickedDayKey && inWeek(pickedDayKey)) return pickedDayKey;
    if (weekDayKeys.includes(todayYmd)) return todayYmd;
    return weekDayKeys[0] ?? todayYmd;
  }, [pickedDayKey, weekDayKeys, todayYmd]);

  const activeDayLabel = useMemo(() => {
    const [y, mo, dd] = activeDayKey.split('-').map(Number);
    const d = new Date(y, mo - 1, dd);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }, [activeDayKey]);

  const selectedDayEvents = useMemo(() => groupedByDay[activeDayKey] ?? [], [groupedByDay, activeDayKey]);

  function assignee(id?: string): string | null {
    if (!id) return null;
    return users.find((u: User) => u.id === id)?.name ?? null;
  }

  const formatDt = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
    d.toLocaleString(undefined, { month: 'short', day: 'numeric', ...(opts ?? {}) });

  const renderStaleRow = (row: UntouchedStaleLeadRow) => {
    const a = assignee(row.lead.assignedToId);
    return (
      <div
        key={row.lead.id}
        className="rounded-lg border border-rose-500/25 bg-rose-950/30 p-3 text-xs space-y-1.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-foreground truncate">
              {row.lead.firstName} {row.lead.lastName}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{row.lead.title}</div>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
            {row.hoursSinceTouch}h quiet
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5 shrink-0" />
            Last touch {formatDt(row.lastTouchAt, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {a && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 shrink-0" />
              Owner {a}
            </span>
          )}
          <span>
            Stage <span className="text-foreground font-medium">{row.lead.status.replace(/_/g, ' ')}</span>
          </span>
        </div>
        <Link
          href="/dashboard/crm"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
        >
          Open in CRM →
        </Link>
      </div>
    );
  };

  const renderStuckProposal = (row: StuckProposalLeadRow) => {
    const a = assignee(row.lead.assignedToId);
    return (
      <div
        key={row.lead.id}
        className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 text-xs space-y-1.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-foreground truncate">
              {row.lead.firstName} {row.lead.lastName}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{row.lead.title}</div>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
            {row.daysInProposal}d in proposal
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">{row.blockedReason}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>
            Proposal since <span className="text-foreground font-medium">{formatDt(row.proposalEnteredAt)}</span>
          </span>
          {a && <span>Owner {a}</span>}
          <span>
            Potential value{' '}
            <span className="text-emerald-400 font-semibold">
              ₹
              {row.lead.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/dashboard/crm"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Pipeline →
          </Link>
          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Payments →
          </Link>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <span className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading operations…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">
            Weekly Ops Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            One place for this week&apos;s departures, CRM follow-ups, and payment dues — plus SLA queues for stalled leads.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setCursor(startOfIsoWeek(addDays(cursor, -7)))}
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary/80"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfIsoWeek(new Date()))}
            className="px-3 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-semibold"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfIsoWeek(addDays(cursor, 7)))}
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary/80"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <CalendarCheck2 className="w-4 h-4 text-emerald-400" /> Week of{' '}
          <strong className="text-foreground">{formatDt(weekStart)}</strong> —{' '}
          <strong className="text-foreground">{formatDt(weekEndDisplay)}</strong>
        </span>
        <span className="inline-flex gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Plane className="w-3.5 h-3.5 text-emerald-400" /> Departures
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PhoneOutgoing className="w-3.5 h-3.5 text-sky-400" /> Follow-ups
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-amber-400" /> Payments due
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {daysAxis.map((day) => {
          const key = formatYMD(day);
          const isTodayCell = todayYmd === key;
          const isSelected = activeDayKey === key;
          const list = groupedByDay[key] ?? [];

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long' })}, ${day.getDate()}, ${list.length} event${list.length === 1 ? '' : 's'}`}
              onClick={(e) => {
                const t = e.target as HTMLElement | null;
                if (t?.closest('a')) return;
                setPickedDayKey(key);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPickedDayKey(key);
                }
              }}
              className={`rounded-xl border p-3 min-h-[140px] flex flex-col gap-2 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isSelected
                  ? 'border-indigo-500/55 bg-indigo-950/40 ring-1 ring-indigo-500/30 shadow-md shadow-indigo-900/15'
                  : isTodayCell
                    ? 'border-teal-500/35 bg-teal-950/20 hover:bg-teal-950/35'
                    : 'border-border bg-card/70 hover:bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-baseline justify-between gap-1 border-b border-border/40 pb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span
                  className={`text-sm font-semibold ${isTodayCell ? 'text-teal-300' : ''} ${isSelected ? '!text-indigo-200' : ''}`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                {list.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic py-4 text-center opacity-70">Clear</p>
                ) : (
                  list.map((ev) => (
                    <Link
                      key={ev.id}
                      href={ev.href}
                      onClick={(e) => e.stopPropagation()}
                      className="block rounded-lg border border-border/50 bg-secondary/40 p-2 space-y-1 transition-colors hover:border-primary/35 hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <div className="flex items-center justify-between gap-1">{kindBadge(ev.kind)}</div>
                      <p className="text-[11px] font-semibold text-foreground leading-snug">{ev.title}</p>
                      {ev.subtitle && (
                        <p className="text-[9px] text-muted-foreground leading-snug line-clamp-2">{ev.subtitle}</p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/80 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <CalendarCheck2 className="w-4 h-4" /> Day timeline — {activeDayLabel}
        </h2>
        {selectedDayEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing scheduled for this day (departures, follow-ups, or payment dues).
          </p>
        ) : (
          <ul className="space-y-2 max-h-[240px] overflow-y-auto text-xs">
            {selectedDayEvents.map((ev) => (
              <li key={ev.id} className="list-none">
                <Link
                  href={ev.href}
                  className="flex flex-wrap items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2 border border-border/40 transition-colors hover:border-primary/35 hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <span className="text-[10px] font-bold text-muted-foreground w-[88px] shrink-0">{ev.dateKey}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">{kindBadge(ev.kind)}</div>
                    <p className="font-semibold">{ev.title}</p>
                    {ev.subtitle && <p className="text-[10px] text-muted-foreground">{ev.subtitle}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card/80 overflow-hidden flex flex-col">
          <header className="px-4 py-3 border-b border-border bg-rose-500/5 flex items-center gap-3">
            <AlarmClock className="w-5 h-5 text-rose-400" />
            <div>
              <h2 className="text-sm font-bold text-foreground">SLA: pipeline quiet 24h+</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Open stages with no touches (notes, activities, completed follow-ups) in the last{' '}
                <strong className="text-foreground">24 hours</strong>.
              </p>
            </div>
            <span className="ml-auto shrink-0 text-lg font-bold text-rose-400 tabular-nums">{untouched24.length}</span>
          </header>
          <div className="p-4 space-y-3 flex-1 max-h-[420px] overflow-y-auto">
            {untouched24.length === 0 ? (
              <p className="text-xs text-muted-foreground">All active leads have been contacted within 24h.</p>
            ) : (
              untouched24.map(renderStaleRow)
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/80 overflow-hidden flex flex-col">
          <header className="px-4 py-3 border-b border-border bg-amber-500/5 flex items-center gap-3">
            <AlarmClock className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-foreground">SLA: proposal sent, no full payment 7d+</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Still in <strong className="text-foreground">PROPOSAL SENT</strong> for a week while linked finance is not
                fully settled.
              </p>
            </div>
            <span className="ml-auto shrink-0 text-lg font-bold text-amber-400 tabular-nums">{proposals7.length}</span>
          </header>
          <div className="p-4 space-y-3 flex-1 max-h-[420px] overflow-y-auto">
            {proposals7.length === 0 ? (
              <p className="text-xs text-muted-foreground">No proposals are stuck past the 7-day window.</p>
            ) : (
              proposals7.map(renderStuckProposal)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
