'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { StructuredActivityDetails } from '@/lib/itinerary-display';

interface DayPlanAccordionProps {
  dayNumber: number;
  city: string;
  highlight: string;
  segments: StructuredActivityDetails[];
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function DayPlanAccordion({
  dayNumber,
  city,
  highlight,
  segments,
  expanded,
  onToggle,
  compact = false,
}: DayPlanAccordionProps) {
  const heading = highlight ? `${city} — ${highlight}` : city;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`day-plan-${dayNumber}`}
        className="flex w-full items-stretch gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80"
      >
        <div className="flex shrink-0 flex-col items-center justify-center border-r border-amber-600/25 pr-3">
          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-amber-700">
            Day
          </span>
          <span className="text-lg font-bold leading-none text-amber-700">
            {String(dayNumber).padStart(2, '0')}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-bold uppercase tracking-wide text-slate-900 ${
                compact ? 'text-[11px]' : 'text-xs'
              }`}
            >
              {city}
            </p>
            {highlight ? (
              <p
                className={`mt-0.5 truncate leading-snug text-slate-600 ${
                  compact ? 'text-[10px]' : 'text-[11px]'
                }`}
              >
                {highlight}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-amber-700 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </div>
        <span className="sr-only">
          {expanded ? 'Collapse' : 'Expand'} plan for {heading}
        </span>
      </button>

      {expanded ? (
        <div id={`day-plan-${dayNumber}`} className="border-t border-slate-100">
          {segments.map((segment, index) => (
            <div
              key={`${segment.category}-${index}`}
              className={`px-3.5 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <p
                className={`font-bold uppercase tracking-[0.14em] text-amber-700 ${
                  compact ? 'text-[8px]' : 'text-[9px]'
                }`}
              >
                {segment.category}
              </p>
              {segment.places ? (
                <p
                  className={`mt-1 leading-snug text-slate-800 ${
                    compact ? 'text-[10px]' : 'text-[11px]'
                  }`}
                >
                  {segment.places}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
