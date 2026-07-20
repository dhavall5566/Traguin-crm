'use client';

import React, { useMemo, useState } from 'react';
import { Itinerary } from '@/lib/store';
import {
  PROPOSAL_THEMES,
  ProposalThemeId,
  resolveProposalTheme,
} from '@/lib/proposalThemes';
import {
  stripItineraryPriceMentions,
  buildSequentialDayPlanSegments,
  extractItineraryHub,
  parseDayExploreTitle,
} from '@/lib/itinerary-display';
import { DayPlanAccordion } from '@/components/proposal/DayPlanAccordion';
import { Calendar, Map, Sparkles } from 'lucide-react';

const statusLabels: Record<Itinerary['status'], string> = {
  DRAFT: 'Draft Proposal',
  SENT: 'Proposal Sent',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
};

interface ClientProposalViewProps {
  itinerary: Itinerary;
  themeId?: ProposalThemeId | string;
  agencyName?: string;
  agencyLogoUrl?: string;
  clientName?: string;
  compact?: boolean;
  id?: string;
}

function formatDateRange(start?: string, end?: string) {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : null;
}

export default function ClientProposalView({
  itinerary,
  themeId,
  agencyName = 'Your Travel Agency',
  agencyLogoUrl,
  clientName,
  compact = false,
  id,
}: ClientProposalViewProps) {
  const theme = PROPOSAL_THEMES[resolveProposalTheme(themeId ?? itinerary.proposalTheme)];
  const dateRange = formatDateRange(itinerary.startDate, itinerary.endDate);
  const totalDays = itinerary.days?.length ?? 0;
  const totalItems = itinerary.days?.reduce((n, d) => n + d.items.length, 0) ?? 0;
  const destinationHub =
    extractItineraryHub(itinerary) ||
    parseDayExploreTitle(itinerary.days?.[0]?.title ?? '').city ||
    '';
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    const ids = (itinerary.days ?? []).map((day) => day.id);
    return new Set(ids);
  });

  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  };

  const dayIdsKey = useMemo(
    () => (itinerary.days ?? []).map((day) => day.id).join(','),
    [itinerary.days],
  );

  const segmentsByDay = useMemo(
    () => buildSequentialDayPlanSegments(itinerary.days ?? [], destinationHub),
    [itinerary.days, destinationHub],
  );

  React.useEffect(() => {
    const ids = (itinerary.days ?? []).map((day) => day.id);
    setExpandedDays(new Set(ids));
  }, [dayIdsKey, itinerary.days]);

  return (
    <div
      id={id}
      className={`relative overflow-hidden rounded-2xl border ${theme.divider} ${theme.page} ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {/* Decorative orbs */}
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl ${theme.orbA}`} />
      <div className={`absolute -bottom-20 -left-12 w-56 h-56 rounded-full blur-3xl ${theme.orbB}`} />

      {/* Hero */}
      <div className={`relative px-5 pt-5 pb-4 border-b ${theme.hero}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {agencyLogoUrl ? (
              <img
                src={agencyLogoUrl}
                alt={agencyName}
                className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl object-cover ring-2 ring-white/10`}
              />
            ) : (
              <div
                className={`${compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-xl bg-white/10 flex items-center justify-center font-bold`}
              >
                {agencyName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className={`font-bold truncate ${theme.title}`}>{agencyName}</p>
              <p className={`text-[9px] uppercase tracking-wider ${theme.subtitle}`}>Curated Travel Proposal</p>
            </div>
          </div>
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${theme.badge}`}>
            {statusLabels[itinerary.status]}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className={`w-3.5 h-3.5 ${theme.subtitle}`} />
            <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.subtitle}`}>
              Personalized Itinerary
            </span>
          </div>
          <h2 className={`${compact ? 'text-sm' : 'text-base'} font-bold leading-snug ${theme.title}`}>
            {itinerary.title}
          </h2>
          {itinerary.description && (
            <p className={`leading-relaxed ${compact ? 'text-[10px]' : 'text-[11px]'} ${theme.subtitle}`}>
              {stripItineraryPriceMentions(itinerary.description)}
            </p>
          )}
        </div>

        <div className={`flex flex-wrap gap-2 mt-4 pt-3 border-t ${theme.divider}`}>
          {dateRange && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium ${theme.itemCard}`}>
              <Calendar className="w-3 h-3" />
              {dateRange}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium ${theme.itemCard}`}>
            <Map className="w-3 h-3" />
            {totalDays} day{totalDays === 1 ? '' : 's'} · {totalItems} segment{totalItems === 1 ? '' : 's'}
          </span>
          {clientName && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium ${theme.itemCard}`}>
              Prepared for {clientName}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className={`relative px-5 py-4 space-y-5 ${compact ? 'max-h-72 overflow-y-auto' : ''}`}>
        {(itinerary.days ?? []).length === 0 ? (
          <div className={`text-center py-8 ${theme.subtitle}`}>Itinerary days will appear here.</div>
        ) : (
          (itinerary.days ?? []).map((day, dayIdx) => (
            <div key={day.id} className="relative pl-8">
              {dayIdx < (itinerary.days?.length ?? 0) - 1 && (
                <div
                  className={`absolute left-[13px] top-8 bottom-0 w-0.5 ${theme.timeline}`}
                  aria-hidden
                />
              )}
              <div
                className={`absolute left-[11px] top-4 h-2 w-2 rounded-full ${theme.dayBadge}`}
                aria-hidden
              />

              <div className="space-y-2">
                <DayPlanAccordion
                  dayNumber={day.dayNumber}
                  city={parseDayExploreTitle(day.title).city}
                  highlight={parseDayExploreTitle(day.title).highlight}
                  segments={segmentsByDay.get(day.id) ?? []}
                  expanded={expandedDays.has(day.id)}
                  onToggle={() => toggleDay(day.id)}
                  compact={compact}
                />
                {day.description && (
                  <p className={`text-[10px] leading-relaxed pl-3 border-l-2 ${theme.dayDesc}`}>
                    {stripItineraryPriceMentions(day.description)}
                  </p>
                )}

              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
