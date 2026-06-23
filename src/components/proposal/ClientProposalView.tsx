'use client';

import React from 'react';
import { Itinerary } from '@/lib/store';
import {
  PROPOSAL_THEMES,
  ProposalThemeId,
  resolveProposalTheme,
} from '@/lib/proposalThemes';
import {
  Hotel,
  Plane,
  Car,
  MapPin,
  Coffee,
  FileText,
  Calendar,
  Map,
  Sparkles,
} from 'lucide-react';

const iconMap = {
  HOTEL: Hotel,
  FLIGHT: Plane,
  TRANSFER: Car,
  ACTIVITY: MapPin,
  MEAL: Coffee,
  NOTE: FileText,
};

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
  showPricing?: boolean;
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
  showPricing = true,
  compact = false,
  id,
}: ClientProposalViewProps) {
  const theme = PROPOSAL_THEMES[resolveProposalTheme(themeId ?? itinerary.proposalTheme)];
  const dateRange = formatDateRange(itinerary.startDate, itinerary.endDate);
  const totalDays = itinerary.days?.length ?? 0;
  const totalItems = itinerary.days?.reduce((n, d) => n + d.items.length, 0) ?? 0;

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
              {itinerary.description}
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
                className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${theme.dayBadge}`}
              >
                {day.dayNumber}
              </div>

              <div className="space-y-2">
                <h3 className={`font-bold ${theme.dayTitle}`}>{day.title}</h3>
                {day.description && (
                  <p className={`text-[10px] leading-relaxed pl-3 border-l-2 ${theme.dayDesc}`}>
                    {day.description}
                  </p>
                )}

                <div className="space-y-1.5 pt-1">
                  {day.items.map((item) => {
                    const ItemIcon = iconMap[item.type] || FileText;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl transition-colors ${theme.itemCard}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${theme.itemIcon}`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-semibold truncate ${theme.itemTitle}`}>{item.title}</p>
                            <p className={`text-[9px] truncate ${theme.itemDetail}`}>{item.details}</p>
                          </div>
                        </div>
                        {showPricing && (
                          <span className={`shrink-0 font-bold text-[10px] ${theme.price}`}>
                            ₹{Number(item.sellingPrice).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {showPricing && (
        <div className={`relative px-5 py-4 ${theme.footer}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={`text-[9px] uppercase tracking-wider font-bold ${theme.subtitle}`}>
                Total Investment
              </p>
              <p className={`text-[9px] ${theme.itemDetail}`}>
                Inclusive of curated segments · taxes as applicable
              </p>
            </div>
            <p className={`${compact ? 'text-lg' : 'text-xl'} font-bold ${theme.price}`}>
              ₹{Number(itinerary.totalPrice).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
