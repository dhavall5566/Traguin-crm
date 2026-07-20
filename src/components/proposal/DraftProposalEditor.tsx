'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Itinerary, ItineraryDay, ItineraryItem } from '@/lib/store';
import {
  buildSequentialDayPlanSegments,
  parseDayExploreTitle,
  type StructuredActivityDetails,
} from '@/lib/itinerary-display';

interface DraftProposalEditorProps {
  itinerary: Itinerary;
  destinationHub: string;
  onUpdateDayTitle: (dayId: string, title: string) => void;
  onDeleteDay: (dayId: string) => void;
  onAddDay: () => void;
  onAddActivity: (dayId: string) => void;
  onEditActivity: (dayId: string, item: ItineraryItem) => void;
  onDeleteActivity: (dayId: string, itemId: string) => void;
}

export default function DraftProposalEditor({
  itinerary,
  destinationHub,
  onUpdateDayTitle,
  onDeleteDay,
  onAddDay,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
}: DraftProposalEditorProps) {
  const totalDays = itinerary.days?.length ?? 0;
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    const ids = (itinerary.days ?? []).map((day) => day.id);
    return new Set(ids);
  });

  const dayIdsKey = useMemo(
    () => (itinerary.days ?? []).map((day) => day.id).join(','),
    [itinerary.days],
  );

  const segmentsByDay = useMemo(
    () => buildSequentialDayPlanSegments(itinerary.days ?? [], destinationHub),
    [itinerary.days, destinationHub],
  );

  useEffect(() => {
    const ids = (itinerary.days ?? []).map((day) => day.id);
    setExpandedDays(new Set(ids));
  }, [dayIdsKey, itinerary.days]);

  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  };

  if (totalDays === 0) return null;

  return (
    <div className="crm-itin-draft">
      <div className="crm-itin-draft__toolbar">
        <div>
          <p className="crm-itin-draft__toolbar-label">Trip schedule</p>
          <p className="crm-itin-draft__toolbar-hint">
            {totalDays} day{totalDays === 1 ? '' : 's'} · expand a day to edit segments
          </p>
        </div>
        <button type="button" onClick={onAddDay} className="crm-itin-btn crm-itin-btn--primary">
          <Plus aria-hidden />
          Add day
        </button>
      </div>

      <div className="crm-itin-draft__days">
        {(itinerary.days ?? []).map((day) => (
          <EditableDayCard
            key={day.id}
            day={day}
            segments={segmentsByDay.get(day.id) ?? []}
            expanded={expandedDays.has(day.id)}
            onToggle={() => toggleDay(day.id)}
            onUpdateDayTitle={onUpdateDayTitle}
            onDeleteDay={onDeleteDay}
            onAddActivity={onAddActivity}
            onEditActivity={onEditActivity}
            onDeleteActivity={onDeleteActivity}
          />
        ))}
      </div>
    </div>
  );
}

function EditableDayCard({
  day,
  segments,
  expanded,
  onToggle,
  onUpdateDayTitle,
  onDeleteDay,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
}: {
  day: ItineraryDay;
  segments: StructuredActivityDetails[];
  expanded: boolean;
  onToggle: () => void;
  onUpdateDayTitle: (dayId: string, title: string) => void;
  onDeleteDay: (dayId: string) => void;
  onAddActivity: (dayId: string) => void;
  onEditActivity: (dayId: string, item: ItineraryItem) => void;
  onDeleteActivity: (dayId: string, itemId: string) => void;
}) {
  const heading = parseDayExploreTitle(day.title);

  return (
    <article className="crm-itin-draft-day">
      <div className="crm-itin-draft-day__header">
        <button
          type="button"
          className="crm-itin-draft-day__toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`draft-day-${day.id}`}
        >
          <div className="crm-itin-draft-day__badge">
            <span className="crm-itin-draft-day__badge-label">Day</span>
            <span className="crm-itin-draft-day__badge-num">
              {String(day.dayNumber).padStart(2, '0')}
            </span>
          </div>
          <div className="crm-itin-draft-day__heading">
            <input
              type="text"
              value={day.title}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdateDayTitle(day.id, e.target.value)}
              placeholder="City — place to explore"
              aria-label={`Day ${day.dayNumber} title`}
              className="crm-itin-draft-day__title-input"
            />
            {heading.highlight ? (
              <p className="crm-itin-draft-day__subtitle">{heading.highlight}</p>
            ) : null}
          </div>
          <ChevronDown
            className={`crm-itin-draft-day__chevron${expanded ? ' crm-itin-draft-day__chevron--open' : ''}`}
            aria-hidden
          />
        </button>

        <div className="crm-itin-draft-day__actions">
          <button
            type="button"
            className="crm-itin-btn crm-itin-btn--danger"
            onClick={() => onDeleteDay(day.id)}
          >
            <Trash2 aria-hidden />
            Delete day
          </button>
          <button
            type="button"
            className="crm-itin-btn crm-itin-btn--primary"
            onClick={() => onAddActivity(day.id)}
          >
            <Plus aria-hidden />
            Add activity
          </button>
        </div>
      </div>

      {expanded ? (
        <div id={`draft-day-${day.id}`} className="crm-itin-draft-day__segments">
          {segments.map((segment, index) => {
            const item = day.items[index];
            return (
              <div key={`${segment.category}-${index}`} className="crm-itin-draft-segment">
                <div className="crm-itin-draft-segment__content">
                  <p className="crm-itin-draft-segment__label">{segment.category}</p>
                  <p className="crm-itin-draft-segment__text">
                    {segment.places || 'No details yet — add an activity for this segment.'}
                  </p>
                </div>
                {item ? (
                  <div className="crm-itin-draft-segment__item-actions">
                    <button
                      type="button"
                      className="crm-itin-icon-btn"
                      title="Edit segment"
                      aria-label={`Edit ${segment.category}`}
                      onClick={() => onEditActivity(day.id, item)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="crm-itin-icon-btn crm-itin-icon-btn--danger"
                      title="Remove segment"
                      aria-label={`Remove ${segment.category}`}
                      onClick={() => onDeleteActivity(day.id, item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
