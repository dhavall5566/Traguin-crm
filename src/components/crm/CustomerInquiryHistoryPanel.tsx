'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Flag,
  History,
  MessageSquare,
  Calendar,
  ClipboardList,
  UserRound,
  ChevronDown,
} from 'lucide-react';
import { formatLeadDisplayCode } from '@/lib/lead-codes';
import {
  type CustomerInquiryHistory,
  type CustomerInteraction,
  type InquiryLeadSummary,
} from '@/lib/api/customer-inquiry';
import {
  LeadTimelineActivityBody,
  LeadTimelineNoteBody,
} from '@/components/crm/LeadTimelineContent';

type CustomerContact = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
};

type CustomerInquiryHistoryPanelProps = {
  history: CustomerInquiryHistory | null;
  loading?: boolean;
  interactionsLoading?: boolean;
  detailsLoading?: boolean;
  currentLeadId?: string;
  onOpenLead?: (leadId: string) => void;
  onExpand?: () => void;
  compact?: boolean;
  contact?: CustomerContact;
  defaultExpanded?: boolean;
  hintReturningCustomer?: boolean;
};

function bookingTotal(history: CustomerInquiryHistory): number {
  return history.booking_count ?? history.bookings.length;
}

function flagTotal(history: CustomerInquiryHistory): number {
  return history.flag_count ?? history.flags.length;
}

function interactionTotal(history: CustomerInquiryHistory): number {
  if (history.interactions.length > 0) {
    return history.interactions.length;
  }
  return history.interaction_count ?? 0;
}

function hasPriorCustomerHistory(
  history: CustomerInquiryHistory,
  currentLeadId?: string,
): boolean {
  if (history.customer_id) return true;
  if (history.total_inquiry_count > 1) return true;
  if (bookingTotal(history) > 0) return true;
  if (flagTotal(history) > 0) return true;
  if (history.past_not_converted.length > 0) return true;
  if (history.last_two_active_enquiries.length > 1) return true;
  if (
    currentLeadId &&
    history.all_leads.some((lead) => lead.id !== currentLeadId)
  ) {
    return true;
  }
  return false;
}

function formatContactLine(contact?: CustomerContact): string | null {
  if (!contact) return null;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  const parts = [name, contact.email, contact.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function CustomerHistoryEmptyState({ message }: { message: string }) {
  return (
    <p className="crm-customer-history-empty">
      <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

function statusTone(label: string): 'success' | 'danger' | 'info' | 'neutral' {
  const normalized = label.toLowerCase();
  if (
    normalized.includes('book') ||
    normalized.includes('closed') ||
    normalized.includes('paid') ||
    normalized.includes('ready')
  ) {
    return 'success';
  }
  if (normalized.includes('dump') || normalized.includes('lost')) return 'danger';
  if (normalized.includes('new') || normalized.includes('assigned')) return 'info';
  return 'neutral';
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className={`crm-customer-history__status-badge crm-customer-history__status-badge--${statusTone(label)}`}>
      {label}
    </span>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function interactionIcon(type: CustomerInteraction['type']) {
  switch (type) {
    case 'inquiry':
      return MessageSquare;
    case 'note':
      return ClipboardList;
    case 'activity':
      return History;
    case 'followup':
      return Calendar;
    case 'booking':
      return ClipboardList;
    case 'flag':
      return Flag;
    default:
      return History;
  }
}

function InteractionRow({
  item,
  currentLeadId,
  onOpenLead,
}: {
  item: CustomerInteraction;
  currentLeadId?: string;
  onOpenLead?: (leadId: string) => void;
}) {
  const Icon = interactionIcon(item.type);
  const showLeadContext = item.lead_id && item.lead_id !== currentLeadId;
  const leadCode =
    item.lead_code && item.lead_id
      ? formatLeadDisplayCode({ leadCode: item.lead_code, id: item.lead_id })
      : null;

  return (
    <div className="crm-customer-interaction">
      <div className="crm-customer-interaction__icon" aria-hidden>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="crm-customer-interaction__body">
        <div className="crm-customer-interaction__meta">
          <span className="crm-customer-interaction__title">
            {item.title}
            {item.author_name ? ` · ${item.author_name}` : ''}
          </span>
          <time className="crm-customer-interaction__time" dateTime={item.at}>
            {formatDateTime(item.at)}
          </time>
        </div>

        {showLeadContext && item.lead_id ? (
          <div className="crm-customer-interaction__lead">
            {onOpenLead ? (
              <button
                type="button"
                className="crm-customer-interaction__lead-link"
                onClick={() => onOpenLead(item.lead_id!)}
              >
                {leadCode ?? item.lead_title ?? 'View inquiry'}
              </button>
            ) : (
              <span className="crm-customer-interaction__lead-text">
                {leadCode ?? item.lead_title}
              </span>
            )}
            {item.lead_title ? (
              <span className="crm-customer-interaction__lead-context"> · {item.lead_title}</span>
            ) : null}
          </div>
        ) : null}

        {item.status_label ? <StatusBadge label={item.status_label} /> : null}

        {item.content ? (
          <div className="crm-customer-interaction__content">
            {item.type === 'note' ? (
              <LeadTimelineNoteBody content={item.content} />
            ) : item.type === 'activity' ? (
              <LeadTimelineActivityBody description={item.content} author={item.author_name ?? ''} />
            ) : (
              <p className="crm-customer-interaction__text">{item.content}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}


function InquiryCard({
  entry,
  interactions,
  isCurrent,
  isOpen,
  onToggle,
  onOpenLead,
}: {
  entry: InquiryLeadSummary;
  interactions: CustomerInteraction[];
  isCurrent: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onOpenLead?: (leadId: string) => void;
}) {
  const code = formatLeadDisplayCode({ leadCode: entry.lead_code ?? undefined, id: entry.id });

  return (
    <div
      className={[
        'crm-customer-history__row',
        isCurrent ? 'crm-customer-history__row--current' : '',
        isOpen ? 'crm-customer-history__row--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="crm-customer-history__row-trigger"
        aria-expanded={isOpen}
        aria-controls={`inquiry-history-${entry.id}`}
        onClick={onToggle}
      >
        <span className="crm-customer-history__row-main">
          <span className="crm-customer-history__row-top">
            <span className="crm-customer-history__row-code">{code}</span>
            <StatusBadge label={entry.status_label} />
          </span>
          <span className="crm-customer-history__row-subtitle">{entry.title}</span>
          <span className="crm-customer-history__row-meta">
            {entry.travel_destination ? <span>{entry.travel_destination}</span> : null}
            {entry.source ? <span>{entry.source}</span> : null}
            <span>{formatDate(entry.created_at)}</span>
          </span>
        </span>
        <span className="crm-customer-history__row-actions">
          {isCurrent ? <span className="crm-customer-history__row-tag">Current</span> : null}
          <ChevronDown
            className={`crm-customer-history__row-chevron ${isOpen ? 'crm-customer-history__row-chevron--open' : ''}`}
            aria-hidden
          />
        </span>
      </button>

      {isOpen ? (
        <div id={`inquiry-history-${entry.id}`} className="crm-customer-history__row-detail">
          <dl className="crm-customer-history__row-facts">
            {entry.assigned_to_name ? (
              <>
                <dt>Assigned to</dt>
                <dd>{entry.assigned_to_name}</dd>
              </>
            ) : null}
            {entry.priority ? (
              <>
                <dt>Priority</dt>
                <dd>{entry.priority.replace(/_/g, ' ')}</dd>
              </>
            ) : null}
            {entry.value != null && entry.value !== '' ? (
              <>
                <dt>Est. value</dt>
                <dd>₹{Number(entry.value).toLocaleString('en-IN')}</dd>
              </>
            ) : null}
            <dt>Last updated</dt>
            <dd>{formatDateTime(entry.updated_at)}</dd>
          </dl>

          {entry.message ? (
            <div className="crm-customer-history__row-message">
              <p className="crm-customer-history__row-message-label">Customer message</p>
              <p className="crm-customer-history__row-note">{entry.message}</p>
            </div>
          ) : null}

          {interactions.length > 0 ? (
            <div className="crm-customer-history__row-timeline">
              <p className="crm-customer-history__row-timeline-label">
                Activity ({interactions.length})
              </p>
              <div className="crm-customer-history__timeline">
                {interactions.map((item) => (
                  <InteractionRow
                    key={item.id}
                    item={item}
                    currentLeadId={entry.id}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="crm-customer-history__row-empty">No activity recorded for this enquiry.</p>
          )}

          {onOpenLead ? (
            <button
              type="button"
              className="crm-customer-history__row-open"
              onClick={() => onOpenLead(entry.id)}
            >
              Open lead record
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CustomerInquiryHistoryPanel({
  history,
  loading = false,
  interactionsLoading = false,
  detailsLoading = false,
  currentLeadId,
  onOpenLead,
  onExpand,
  compact = false,
  contact,
  defaultExpanded = false,
  hintReturningCustomer = false,
}: CustomerInquiryHistoryPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);
  const expandedForLeadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentLeadId) return;
    if (expandedForLeadRef.current === currentLeadId) return;
    expandedForLeadRef.current = currentLeadId;
    setExpanded((prev) => (prev === defaultExpanded ? prev : defaultExpanded));
    setExpandedInquiryId((prev) => (prev === null ? prev : null));
  }, [currentLeadId, defaultExpanded]);

  const interactions = useMemo(
    () => history?.interactions ?? [],
    [history?.interactions],
  );

  const interactionsByLeadId = useMemo(() => {
    const map = new Map<string, CustomerInteraction[]>();
    for (const item of interactions) {
      if (!item.lead_id) continue;
      const existing = map.get(item.lead_id) ?? [];
      existing.push(item);
      map.set(item.lead_id, existing);
    }
    for (const [leadId, items] of map) {
      map.set(
        leadId,
        items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
      );
    }
    return map;
  }, [interactions]);

  const allInquiries = history?.all_leads ?? [];
  const currentInquiry = allInquiries.find((entry) => entry.id === currentLeadId) ?? null;
  const pastInquiries = allInquiries.filter((entry) => entry.id !== currentLeadId);
  const contactLine = formatContactLine(contact);

  if (loading && !history) {
    const loadingLabel = hintReturningCustomer ? 'Returning customer' : 'Customer history';
    if (hintReturningCustomer && contactLine) {
      return (
        <section
          className={`crm-customer-history ${compact ? 'crm-customer-history--compact' : ''} crm-customer-history--loading`}
        >
          <div
            className="crm-customer-history__trigger crm-customer-history__trigger--static"
            aria-busy="true"
          >
            <span className="crm-customer-history__trigger-main">
              <span className="crm-customer-history__eyebrow">{loadingLabel}</span>
              <span className="crm-customer-history__contact">{contactLine}</span>
              <span className="crm-customer-history__stats crm-customer-history__stats--loading">
                Fetching enquiry summary…
              </span>
            </span>
            <ChevronDown className="crm-customer-history__chevron" aria-hidden />
          </div>
        </section>
      );
    }
    return (
      <section className={`crm-customer-history crm-customer-history--loading ${compact ? 'crm-customer-history--compact' : ''}`}>
        <div className="crm-customer-history__trigger crm-customer-history__trigger--static" aria-busy="true">
          <span className="crm-customer-history__trigger-main">
            <span className="crm-customer-history__eyebrow">{loadingLabel}</span>
            {contactLine ? (
              <span className="crm-customer-history__contact">{contactLine}</span>
            ) : null}
            <span className="crm-customer-history__stats crm-customer-history__stats--loading">
              Fetching enquiry summary…
            </span>
          </span>
        </div>
      </section>
    );
  }

  if (!history) {
    return (
      <CustomerHistoryEmptyState message="No previous customer history found for this contact." />
    );
  }

  if (!hasPriorCustomerHistory(history, currentLeadId)) {
    return (
      <CustomerHistoryEmptyState message="First enquiry from this contact — no previous inquiries, bookings, or notes on record." />
    );
  }

  const isReturningCustomer = history.total_inquiry_count > 1;
  const isExistingCustomer = Boolean(history.customer_id);
  const panelLabel = isReturningCustomer
    ? 'Returning customer'
    : isExistingCustomer
      ? 'Existing customer'
      : 'Customer history';
  const totalInteractions = interactionTotal(history);
  const totalBookings = bookingTotal(history);
  const isSummaryOnly = history.all_leads.length === 0 && history.total_inquiry_count > 0;
  const statsParts = [
    `${history.total_inquiry_count} ${history.total_inquiry_count === 1 ? 'enquiry' : 'enquiries'}`,
    `${totalBookings} ${totalBookings === 1 ? 'booking' : 'bookings'}`,
  ];
  if (!isSummaryOnly) {
    statsParts.push(
      `${totalInteractions} ${totalInteractions === 1 ? 'interaction' : 'interactions'}`,
    );
  }
  const statsLine = statsParts.join(' · ');

  const handleToggleExpanded = () => {
    setExpanded((open) => {
      const next = !open;
      if (next) onExpand?.();
      return next;
    });
  };

  return (
    <section
      className={`crm-customer-history ${compact ? 'crm-customer-history--compact' : ''} ${
        expanded ? 'crm-customer-history--open' : ''
      }`}
    >
      <button
        type="button"
        className="crm-customer-history__trigger"
        aria-expanded={expanded}
        aria-controls="customer-history-details"
        onClick={handleToggleExpanded}
      >
        <span className="crm-customer-history__trigger-main">
          <span className="crm-customer-history__eyebrow">{panelLabel}</span>
          {contactLine ? (
            <span className="crm-customer-history__contact">{contactLine}</span>
          ) : null}
          <span className="crm-customer-history__stats">{statsLine}</span>
        </span>
        <ChevronDown
          className={`crm-customer-history__chevron ${expanded ? 'crm-customer-history__chevron--open' : ''}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id="customer-history-details" className="crm-customer-history__details">
          {detailsLoading || interactionsLoading ? (
            <p className="crm-customer-history__details-loading">Loading enquiry details…</p>
          ) : null}
          {allInquiries.length > 0 ? (
            <section className="crm-customer-history__section">
              <h3 className="crm-customer-history__section-title">
                Inquiries ({allInquiries.length})
              </h3>
              <div className="crm-customer-history__inquiries">
                {currentInquiry ? (
                  <InquiryCard
                    entry={currentInquiry}
                    interactions={interactionsByLeadId.get(currentInquiry.id) ?? []}
                    isCurrent
                    isOpen={expandedInquiryId === currentInquiry.id}
                    onToggle={() =>
                      setExpandedInquiryId((prev) =>
                        prev === currentInquiry.id ? null : currentInquiry.id,
                      )
                    }
                    onOpenLead={onOpenLead}
                  />
                ) : null}
                {pastInquiries.map((entry) => (
                  <InquiryCard
                    key={entry.id}
                    entry={entry}
                    interactions={interactionsByLeadId.get(entry.id) ?? []}
                    isCurrent={false}
                    isOpen={expandedInquiryId === entry.id}
                    onToggle={() =>
                      setExpandedInquiryId((prev) => (prev === entry.id ? null : entry.id))
                    }
                    onOpenLead={onOpenLead}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {history.bookings.length > 0 ? (
            <section className="crm-customer-history__section">
              <h3 className="crm-customer-history__section-title">
                Bookings ({history.bookings.length})
              </h3>
              <ul className="crm-customer-history__bookings">
                {history.bookings.map((booking) => (
                  <li key={booking.id} className="crm-customer-history__booking">
                    <div className="crm-customer-history__booking-main">
                      <span className="crm-customer-history__booking-title">
                        {booking.itinerary_title || 'Travel booking'}
                      </span>
                      <span className="crm-customer-history__booking-date">
                        Booked {formatDate(booking.created_at)}
                      </span>
                    </div>
                    <StatusBadge label={booking.status} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
