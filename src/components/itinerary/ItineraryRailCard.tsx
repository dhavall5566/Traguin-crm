'use client';

import type { MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Itinerary } from '@/lib/store';
import {
  formatRailDuration,
  formatRailPrice,
  getItineraryRailMeta,
} from '@/lib/itinerary-rail-meta';

const STATUS_LABELS: Record<Itinerary['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
};

interface ItineraryRailCardProps {
  itinerary: Itinerary;
  selected: boolean;
  clientTotal: number;
  unsaved?: boolean;
  onSelect: () => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
}

export default function ItineraryRailCard({
  itinerary,
  selected,
  clientTotal,
  unsaved = false,
  onSelect,
  onDelete,
}: ItineraryRailCardProps) {
  const dayCount = itinerary.days?.length ?? 0;
  const meta = getItineraryRailMeta(itinerary.title, dayCount);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${meta.destination}, ${formatRailDuration(meta.durationDays)}, ${formatRailPrice(clientTotal)}`}
      className={`crm-itin-card${selected ? ' crm-itin-card--active' : ''}`}
    >
      <div className="crm-itin-card__inner">
        <div className="crm-itin-card__head">
          <span
            className="crm-itin-dot crm-itin-card__status-dot"
            data-status={itinerary.status}
            title={STATUS_LABELS[itinerary.status]}
          />
          <div className="crm-itin-card__title-block">
            <p className="crm-itin-card__destination">{meta.destination}</p>
            <div className="crm-itin-card__meta">
              <span className="crm-itin-card__chip">{formatRailDuration(meta.durationDays)}</span>
              <span className="crm-itin-card__status" data-status={itinerary.status}>
                {STATUS_LABELS[itinerary.status]}
              </span>
              {meta.isAi ? <span className="crm-itin-card__chip crm-itin-card__chip--ai">AI</span> : null}
              {unsaved ? <span className="crm-itin-card__chip crm-itin-card__chip--dirty">Unsaved</span> : null}
            </div>
          </div>
          <p className="crm-itin-card__price">{formatRailPrice(clientTotal)}</p>
          <button
            type="button"
            title="Delete itinerary"
            aria-label={`Delete itinerary: ${meta.destination}`}
            onClick={onDelete}
            className="crm-itin-card__delete"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
