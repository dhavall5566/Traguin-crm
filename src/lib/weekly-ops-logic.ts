/**
 * Pure helpers for Weekly Ops calendar + SLA queues (scope by agency first in callers).
 */

import {
  bookingTravellerLabel,
  type Booking,
  type Customer,
  type Invoice,
  type Lead,
  type LeadActivity,
  type LeadFollowup,
  type LeadNote,
  type Itinerary,
  type Payment,
} from '@/lib/store';

/** Structured activity type written by the CRM API on PROPOSAL_SENT entry. */
export const ENTERED_PROPOSAL_SENT_ACTIVITY = 'ENTERED_PROPOSAL_SENT';

/** Legacy pre-column STAGE_CHANGE descriptions (demo seed / old UI). */
const LEGACY_PROPOSAL_SENT_STAGE_CHANGE = /\bto\s+PROPOSAL_SENT\b/i;

export type OpsCalendarEventKind = 'departure' | 'follow_up' | 'payment_due';

export interface OpsCalendarEvent {
  id: string;
  kind: OpsCalendarEventKind;
  /** Local calendar date YYYY-MM-DD */
  dateKey: string;
  title: string;
  subtitle?: string;
  /** Deep-link from Weekly Ops (CRM lead, trip planner, or billing invoice). */
  href: string;
}

const ACTIVE_PIPELINE: Lead['status'][] = ['NEW', 'CONTACTED', 'PROPOSAL_SENT', 'NEGOTIATION'];

export function startOfIsoWeek(reference: Date): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseDateKey(s?: string): Date | null {
  if (!s) return null;
  const part = s.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return null;
  const [y, mo, dd] = part.split('-').map(Number);
  const dt = new Date(y, mo - 1, dd);
  return isNaN(dt.getTime()) ? null : dt;
}

function calendarDayLocal(input: string): Date | null {
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function invoicePaidTotal(inv: Invoice, payments: Payment[]): number {
  return payments
    .filter((p) => p.invoiceId === inv.id)
    .reduce((s, p) => s + Number(p.amount), 0);
}

function resolveLeadCustomerId(lead: Lead, customers: Customer[]): string | undefined {
  if (lead.customerId) return lead.customerId;
  if (!lead.email) return undefined;
  const normalized = lead.email.trim().toLowerCase();
  return customers.find((c) => c.email.trim().toLowerCase() === normalized)?.id;
}

export function customerFullyPaid(
  customerId: string,
  bookings: Booking[],
  invoices: Invoice[],
  payments: Payment[],
): boolean {
  const bookingIds = new Set(bookings.filter((b) => b.customerId === customerId).map((b) => b.id));
  const invs = invoices.filter((inv) => bookingIds.has(inv.bookingId));
  if (invs.length === 0) return false;
  return invs.every((inv) => {
    const paid = invoicePaidTotal(inv, payments);
    return paid >= Number(inv.amount) - 0.01;
  });
}

export function proposalSentEnteredAt(lead: Lead, activities: LeadActivity[]): Date | null {
  if (lead.proposalSentAt) {
    const fromColumn = new Date(lead.proposalSentAt);
    if (!isNaN(fromColumn.getTime())) return fromColumn;
  }

  const structured = activities
    .filter((a) => a.leadId === lead.id && a.type === ENTERED_PROPOSAL_SENT_ACTIVITY)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (structured.length > 0) return new Date(structured[0].createdAt);

  // Legacy-only: demo seed / pre-proposal_sent_at rows with UI STAGE_CHANGE text.
  const legacyStageChanges = activities
    .filter(
      (a) =>
        a.leadId === lead.id &&
        a.type === 'STAGE_CHANGE' &&
        LEGACY_PROPOSAL_SENT_STAGE_CHANGE.test(a.description),
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (legacyStageChanges.length > 0) return new Date(legacyStageChanges[0].createdAt);

  return null;
}

export function lastLeadTouchAt(
  lead: Lead,
  notes: LeadNote[],
  activities: LeadActivity[],
  followups: LeadFollowup[],
): Date {
  const times: number[] = [new Date(lead.createdAt).getTime()];
  if (lead.updatedAt) {
    times.push(new Date(lead.updatedAt).getTime());
  }
  notes
    .filter((n) => n.leadId === lead.id)
    .forEach((n) => times.push(new Date(n.createdAt).getTime()));
  activities
    .filter((a) => a.leadId === lead.id)
    .forEach((a) => times.push(new Date(a.createdAt).getTime()));
  followups
    .filter((f) => f.leadId === lead.id && f.status === 'COMPLETED')
    .forEach((f) => times.push(new Date(f.scheduledAt).getTime()));
  return new Date(Math.max(...times));
}

export interface UntouchedStaleLeadRow {
  lead: Lead;
  lastTouchAt: Date;
  hoursSinceTouch: number;
}

export interface StuckProposalLeadRow {
  lead: Lead;
  proposalEnteredAt: Date;
  daysInProposal: number;
  blockedReason: string;
}

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

export function getUntouchedStaleLeads(
  leads: Lead[],
  notes: LeadNote[],
  activities: LeadActivity[],
  followups: LeadFollowup[],
  now: Date,
  hoursStale: number,
): UntouchedStaleLeadRow[] {
  const thresholdMs = hoursStale * MS_HOUR;
  const out: UntouchedStaleLeadRow[] = [];

  leads.forEach((lead) => {
    if (!ACTIVE_PIPELINE.includes(lead.status)) return;
    const last = lastLeadTouchAt(lead, notes, activities, followups);
    const diff = now.getTime() - last.getTime();
    if (diff < thresholdMs) return;
    out.push({
      lead,
      lastTouchAt: last,
      hoursSinceTouch: Math.floor(diff / MS_HOUR),
    });
  });

  out.sort((a, b) => b.hoursSinceTouch - a.hoursSinceTouch);
  return out;
}

export function getStuckProposalLeads(
  leads: Lead[],
  customers: Customer[],
  bookings: Booking[],
  invoices: Invoice[],
  payments: Payment[],
  activities: LeadActivity[],
  now: Date,
  daysStuck: number,
): StuckProposalLeadRow[] {
  const out: StuckProposalLeadRow[] = [];

  leads.forEach((lead) => {
    if (lead.status !== 'PROPOSAL_SENT') return;
    const entered = proposalSentEnteredAt(lead, activities);
    const fallback = entered ?? (lead.updatedAt ? new Date(lead.updatedAt) : null);
    if (!fallback) return;
    const anchor = fallback;
    const daysInProposal = Math.floor((now.getTime() - anchor.getTime()) / MS_DAY);
    if (daysInProposal < daysStuck) return;

    const custId = resolveLeadCustomerId(lead, customers);

    let stuck = true;
    if (custId !== undefined && customerFullyPaid(custId, bookings, invoices, payments)) stuck = false;
    if (!stuck) return;

    let blockedReason = '';
    if (custId === undefined) blockedReason = 'No customer linked — tie email to a profile for finance tracking.';
    else if (!bookings.some((b) => b.customerId === custId))
      blockedReason = 'No booking created yet — traveler has not formally converted.';
    else blockedReason = 'Outstanding balance — collect payment or reconcile invoice.';

    out.push({
      lead,
      proposalEnteredAt: anchor,
      daysInProposal,
      blockedReason,
    });
  });

  out.sort((a, b) => b.daysInProposal - a.daysInProposal);
  return out;
}

export function buildWeekCalendarEvents(
  itineraries: Itinerary[],
  followups: LeadFollowup[],
  invoices: Invoice[],
  bookings: Booking[],
  payments: Payment[],
  leads: Lead[],
  customers: Customer[],
  rangeStart: Date,
): OpsCalendarEvent[] {
  const rangeEnd = addDays(rangeStart, 7);
  const events: OpsCalendarEvent[] = [];
  let nid = 0;
  const nextId = () => `ev-${++nid}`;

  itineraries.forEach((it) => {
    const sd = parseDateKey(it.startDate);
    if (!sd) return;
    if (sd.getTime() < rangeStart.getTime() || sd.getTime() >= rangeEnd.getTime()) return;
    const cust = it.customerId ? customers.find((c) => c.id === it.customerId) : undefined;
    const traveller = cust ? `${cust.firstName} ${cust.lastName}` : 'Unassigned traveller';
    events.push({
      id: nextId(),
      kind: 'departure',
      dateKey: formatYMD(sd),
      title: it.title?.trim() || 'Departing trip',
      subtitle: traveller,
      href: `/dashboard/itinerary?openPlan=${encodeURIComponent(it.id)}`,
    });
  });

  followups.forEach((f) => {
    if (f.status !== 'PENDING') return;
    const fuDay = calendarDayLocal(f.scheduledAt);
    if (!fuDay) return;
    const rs = new Date(rangeStart);
    rs.setHours(0, 0, 0, 0);
    const re = new Date(rangeEnd);
    re.setHours(0, 0, 0, 0);
    if (fuDay.getTime() < rs.getTime() || fuDay.getTime() >= re.getTime()) return;
    const lead = leads.find((l) => l.id === f.leadId);
    events.push({
      id: nextId(),
      kind: 'follow_up',
      dateKey: formatYMD(fuDay),
      title: lead ? `${lead.firstName} ${lead.lastName}` : 'Lead follow-up',
      subtitle: f.notes?.slice(0, 90) ?? 'Scheduled outreach',
      href: `/dashboard/crm?openLead=${encodeURIComponent(f.leadId)}`,
    });
  });

  invoices.forEach((inv) => {
    const dd = parseDateKey(inv.dueDate);
    if (!dd) return;
    dd.setHours(0, 0, 0, 0);
    if (dd.getTime() < rangeStart.getTime() || dd.getTime() >= rangeEnd.getTime()) return;

    const paid = invoicePaidTotal(inv, payments);
    if (paid >= Number(inv.amount) - 0.01) return;

    const booking = bookings.find((b) => b.id === inv.bookingId);
    const who =
      booking != null ? bookingTravellerLabel(booking, customers) : 'Booking';
    const owing = Number(inv.amount) - paid;

    events.push({
      id: nextId(),
      kind: 'payment_due',
      dateKey: formatYMD(dd),
      title: `Payment due — ${inv.invoiceNumber}`,
      subtitle: `${who} · balance ${owing.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ₹`,
      href: `/dashboard/finance?openInvoice=${encodeURIComponent(inv.id)}`,
    });
  });

  return events;
}
