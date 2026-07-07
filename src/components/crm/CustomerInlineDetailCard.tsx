'use client';

import { History, Mail, Phone, X } from 'lucide-react';
import type { Booking, Customer, Invoice, Itinerary } from '@/lib/store';

export type CustomerTravelEntry = {
  id: string;
  label: string;
  meta?: string;
  date?: string;
};

export function buildCustomerTravelEntries(
  customer: Customer,
  bookings: Booking[],
  itineraries: Itinerary[],
  invoices: Invoice[],
): CustomerTravelEntry[] {
  const entries: CustomerTravelEntry[] = [];
  const seen = new Set<string>();

  for (const [idx, hist] of customer.travelHistory.entries()) {
    const label = hist.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    entries.push({ id: `hist-${idx}`, label });
  }

  const customerBookings = bookings
    .filter((b) => b.agencyId === customer.agencyId && b.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const booking of customerBookings) {
    const itinerary = itineraries.find((i) => i.id === booking.itineraryId);
    const invoice = invoices.find((i) => i.bookingId === booking.id);
    const label = itinerary?.title?.trim() || `Booking ${booking.id.slice(0, 8)}`;
    const amount = invoice != null ? Number(invoice.amount) : itinerary?.totalPrice;
    const amountLabel =
      amount != null && Number.isFinite(amount) ? ` · ₹${amount.toLocaleString('en-IN')}` : '';
    entries.push({
      id: `booking-${booking.id}`,
      label,
      meta: `${booking.status.replace(/_/g, ' ')}${amountLabel}`,
      date: booking.createdAt,
    });
  }

  return entries;
}

type CustomerInlineDetailCardProps = {
  customer: Customer;
  travelEntries: CustomerTravelEntry[];
  passportExpired: boolean;
  onClose: () => void;
};

export function CustomerInlineDetailCard({
  customer,
  travelEntries,
  passportExpired,
  onClose,
}: CustomerInlineDetailCardProps) {
  return (
    <div className="crm-customer-inline-card">
      <button
        type="button"
        onClick={onClose}
        className="crm-customer-inline-card__close"
        aria-label="Close customer details"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="crm-customer-inline-card__grid">
        <div>
          <p className="crm-customer-inline-card__label">Contact</p>
          <p className="crm-customer-inline-card__value flex items-center gap-1.5">
            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {customer.email}
          </p>
          <p className="crm-customer-inline-card__value mt-1 flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {customer.phone || 'Not set'}
          </p>
        </div>
        <div>
          <p className="crm-customer-inline-card__label">Passport</p>
          <p className="crm-customer-inline-card__value font-mono">
            {customer.passportNumber || 'Not set'}
          </p>
          <p
            className={`crm-customer-inline-card__value mt-1 ${passportExpired ? 'text-red-400 font-semibold' : ''}`}
          >
            Expires {customer.passportExpiry || '—'}
          </p>
        </div>
      </div>

      <div className="crm-customer-inline-card__history">
        <p className="crm-customer-inline-card__label flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" aria-hidden />
          Past travel history
        </p>
        {travelEntries.length > 0 ? (
          <ul className="crm-customer-inline-card__history-list">
            {travelEntries.map((entry) => (
              <li key={entry.id} className="crm-customer-inline-card__history-item">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{entry.label}</p>
                  {entry.meta ? (
                    <p className="text-[10px] text-muted-foreground">{entry.meta}</p>
                  ) : null}
                </div>
                {entry.date ? (
                  <time className="shrink-0 text-[9px] text-muted-foreground" dateTime={entry.date}>
                    {new Date(entry.date).toLocaleDateString()}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] italic text-muted-foreground/80">
            No trips recorded yet. Completed bookings will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
