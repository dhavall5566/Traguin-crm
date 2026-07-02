'use client';

import Link from 'next/link';
import type { LeadIntakeDetails } from '@/lib/lead-intake-display';

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '—') return null;
  return (
    <div className="crm-intake-detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function LeadIntakeDetailsPanel({ intake }: { intake: LeadIntakeDetails }) {
  return (
    <section className="crm-intake-panel">
      <div className="crm-intake-panel__header">
        <p className="crm-intake-panel__eyebrow">Website intake</p>
        <h3 className="crm-intake-panel__title">Plan My Journey details</h3>
      </div>

      <dl className="crm-intake-panel__grid">
        <DetailItem label="Customer ID" value={intake.memberCode} />
        <DetailItem label="Inquiry ID" value={intake.inquiryCode} />
        <DetailItem label="Itinerary" value={intake.itineraryTitle} />
        <DetailItem label="Destination" value={intake.destination} />
        <DetailItem label="Start date" value={intake.startDate} />
        <DetailItem label="End date" value={intake.endDate} />
        <DetailItem label="Rooms" value={intake.rooms} />
        <DetailItem label="Adults" value={intake.adults} />
        <DetailItem label="Children" value={intake.children} />
        <DetailItem label="Children ages" value={intake.childAges} />
        <DetailItem label="Pets" value={intake.travelingWithPets} />
        <DetailItem label="Budget (INR)" value={intake.budget} />
        <DetailItem label="Guest name" value={intake.name} />
        <DetailItem label="Email" value={intake.email} />
        <DetailItem label="Phone" value={intake.phone} />
        <DetailItem label="Notes" value={intake.notes} />
        {intake.extras.map((item) => (
          <DetailItem key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
        ))}
      </dl>

      {intake.relatedItineraryId ? (
        <p className="crm-intake-panel__meta">CMS itinerary ID: {intake.relatedItineraryId}</p>
      ) : null}
      {intake.formSubmissionId ? (
        <p className="crm-intake-panel__meta">Form submission ID: {intake.formSubmissionId}</p>
      ) : null}
      <p className="crm-intake-panel__meta">
        <Link href="/dashboard/itinerary" className="text-[var(--gold)] hover:underline">
          View all itineraries in Trip planner
        </Link>
      </p>
    </section>
  );
}
