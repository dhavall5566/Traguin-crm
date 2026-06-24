'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore, Booking, bookingTravellerLabel } from '@/lib/store';
import { useBookingsInvoices } from '@/hooks/useBookingsInvoices';
import { useCustomersPage } from '@/hooks/useCustomersPage';
import { useItineraryPage } from '@/hooks/useItineraryPage';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { mapBookingFromApi, updateBooking } from '@/lib/api/bookings';
import { invalidateCrmListCache } from '@/lib/api/crm-list-cache';
import { CRM_CACHE, patchCrmWorkspaceItem } from '@/lib/api/crm-workspace-store';
import {
  ClipboardList,
  ExternalLink,
  FileText,
  Search,
  X,
} from 'lucide-react';

const BOOKING_STATUSES: Booking['status'][] = [
  'PENDING',
  'PROCESSING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];

type StatusFilter = 'ALL' | Booking['status'];

function formatBookingRef(bookingId: string): string {
  return bookingId.startsWith('book-')
    ? bookingId.replace('book-', '#')
    : `#${bookingId.slice(0, 8).toUpperCase()}`;
}

function statusBadgeClass(status: Booking['status']): string {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'bg-emerald-500/10 text-emerald-600';
    case 'PROCESSING':
      return 'bg-primary/10 text-primary';
    case 'CANCELLED':
      return 'bg-rose-500/10 text-rose-500';
    case 'PENDING':
    default:
      return 'bg-amber-500/10 text-amber-600';
  }
}

export default function BookingsPage() {
  const { currentAgency } = useStore();
  const { bookings, invoices, loading, backgroundLoading, refresh } = useBookingsInvoices();
  const { customers } = useCustomersPage();
  const { itineraries } = useItineraryPage();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const agencyBookings = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return bookings
      .filter((b) => b.agencyId === currentAgency.id)
      .filter((b) => statusFilter === 'ALL' || b.status === statusFilter)
      .filter((b) => {
        if (!q) return true;
        const traveller = bookingTravellerLabel(b, customers).toLowerCase();
        const trip = itineraries.find((i) => i.id === b.itineraryId)?.title?.toLowerCase() ?? '';
        const ref = formatBookingRef(b.id).toLowerCase();
        return traveller.includes(q) || trip.includes(q) || ref.includes(q) || b.id.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, currentAgency.id, debouncedSearch, statusFilter, customers, itineraries]);

  const bookingsPagination = useClientPagination(agencyBookings, undefined, [
    debouncedSearch,
    statusFilter,
  ]);

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return agencyBookings.find((b) => b.id === selectedBookingId) ?? null;
  }, [agencyBookings, selectedBookingId]);

  const selectedInvoice = useMemo(() => {
    if (!selectedBooking) return null;
    return invoices.find((inv) => inv.bookingId === selectedBooking.id) ?? null;
  }, [invoices, selectedBooking]);

  const stats = useMemo(() => {
    const agency = bookings.filter((b) => b.agencyId === currentAgency.id);
    return {
      total: agency.length,
      pending: agency.filter((b) => b.status === 'PENDING').length,
      active: agency.filter((b) => b.status === 'PROCESSING' || b.status === 'CONFIRMED').length,
      completed: agency.filter((b) => b.status === 'COMPLETED').length,
    };
  }, [bookings, currentAgency.id]);

  const isEmptyAgency = !loading && agencyBookings.length === 0 && !debouncedSearch && statusFilter === 'ALL';

  const handleStatusChange = async (bookingId: string, status: Booking['status']) => {
    const existing = bookings.find((b) => b.id === bookingId);
    if (!existing || existing.status === status) return;

    setActionError(null);
    setSavingStatusId(bookingId);
    patchCrmWorkspaceItem(CRM_CACHE.bookings, bookingId, { status });

    try {
      const apiBooking = await updateBooking(bookingId, { status });
      const mapped = mapBookingFromApi(apiBooking);
      patchCrmWorkspaceItem(CRM_CACHE.bookings, bookingId, mapped);
      invalidateCrmListCache(CRM_CACHE.bookings);
      await refresh();
    } catch (error) {
      patchCrmWorkspaceItem(CRM_CACHE.bookings, bookingId, { status: existing.status });
      setActionError(error instanceof Error ? error.message : 'Failed to update booking status');
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-header__title">Bookings</h1>
          <p className="crm-page-header__meta">
            {stats.total} booking{stats.total === 1 ? '' : 's'} · {stats.pending} pending ·{' '}
            {stats.active} in progress
            {backgroundLoading ? ' · Syncing…' : ''}
          </p>
        </div>
        <div className="crm-page-actions">
          <Link href="/dashboard/crm" className="crm-btn-outline text-xs">
            <ClipboardList className="h-3.5 w-3.5" />
            Convert from leads
          </Link>
        </div>
      </div>

      {loading && bookings.length === 0 && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
          Loading bookings…
        </div>
      )}

      {actionError && (
        <div className="crm-alert-error text-xs">{actionError}</div>
      )}

      {isEmptyAgency && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No bookings yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Bookings appear when you convert a lead with a trip proposal. Open Leads, attach an itinerary, then use
            &quot;Create booking&quot;.
          </p>
          <Link
            href="/dashboard/crm"
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            Go to Leads
          </Link>
        </div>
      )}

      <div className="crm-filter-bar text-xs">
        <div className="crm-filter-bar__search">
          <Search className="crm-filter-bar__search-icon" />
          <input
            type="text"
            placeholder="Search by traveller, trip, or booking reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="crm-filter-bar__input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CrmTablePanel
            tabs={[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'PROCESSING', label: 'Processing' },
              { id: 'CONFIRMED', label: 'Confirmed' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CANCELLED', label: 'Cancelled' },
            ]}
            activeTab={statusFilter}
            onTabChange={(id) => setStatusFilter(id as StatusFilter)}
          >
            <div className="crm-table-wrap">
              <div className="overflow-x-auto">
                <table className="crm-data-table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Traveller</th>
                      <th>Trip</th>
                      <th>Status</th>
                      <th>Invoice</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-3">
                          <CrmTableSkeleton columns={6} rows={8} />
                        </td>
                      </tr>
                    ) : (
                      bookingsPagination.pageItems.map((booking) => {
                        const traveller = bookingTravellerLabel(booking, customers);
                        const trip = itineraries.find((i) => i.id === booking.itineraryId);
                        const invoice = invoices.find((inv) => inv.bookingId === booking.id);
                        const isSelected = selectedBookingId === booking.id;

                        return (
                          <tr
                            key={booking.id}
                            onClick={() => setSelectedBookingId(booking.id)}
                            className={`cursor-pointer ${isSelected ? 'crm-data-table__row--selected' : ''}`}
                          >
                            <td className="font-mono text-[10px] font-semibold">
                              {formatBookingRef(booking.id)}
                            </td>
                            <td className="font-semibold max-w-[140px] truncate" title={traveller}>
                              {traveller}
                            </td>
                            <td className="text-muted-foreground max-w-[160px] truncate" title={trip?.title}>
                              {trip?.title ?? '—'}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <select
                                value={booking.status}
                                disabled={savingStatusId === booking.id}
                                onChange={(e) =>
                                  void handleStatusChange(booking.id, e.target.value as Booking['status'])
                                }
                                className={`max-w-[9rem] rounded-full border border-border bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase ${statusBadgeClass(booking.status)}`}
                              >
                                {BOOKING_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replace(/_/g, ' ')}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-[10px]">
                              {invoice ? (
                                <Link
                                  href={`/dashboard/finance?openInvoice=${invoice.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                                >
                                  <FileText className="h-3 w-3 shrink-0" />
                                  {invoice.invoiceNumber}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="text-muted-foreground whitespace-nowrap">
                              {new Date(booking.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {!loading && agencyBookings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="crm-data-table__empty">
                          {debouncedSearch || statusFilter !== 'ALL'
                            ? 'No bookings match this filter.'
                            : 'No bookings recorded.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <CrmTablePagination
                label="Bookings"
                rangeStart={bookingsPagination.rangeStart}
                rangeEnd={bookingsPagination.rangeEnd}
                total={bookingsPagination.total}
                page={bookingsPagination.page}
                totalPages={bookingsPagination.totalPages}
                hasPrev={bookingsPagination.hasPrev}
                hasNext={bookingsPagination.hasNext}
                onPrev={bookingsPagination.goPrev}
                onNext={bookingsPagination.goNext}
                backgroundLoading={backgroundLoading}
              />
            </div>
          </CrmTablePanel>
        </div>

        <div className="p-5 bg-card border border-border rounded-xl space-y-5 text-xs">
          {selectedBooking ? (
            <>
              <div className="flex justify-between items-start border-b border-border pb-4 gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Booking detail
                  </p>
                  <h3 className="font-bold text-sm mt-1 font-mono">
                    {formatBookingRef(selectedBooking.id)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Created {new Date(selectedBooking.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBookingId(null)}
                  className="p-1 rounded hover:bg-secondary shrink-0"
                  aria-label="Close booking detail"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Traveller
                  </span>
                  <p className="font-semibold mt-0.5">
                    {bookingTravellerLabel(selectedBooking, customers)}
                  </p>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Trip
                  </span>
                  {selectedBooking.itineraryId ? (
                    <Link
                      href="/dashboard/itinerary"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline mt-0.5"
                    >
                      {itineraries.find((i) => i.id === selectedBooking.itineraryId)?.title ?? 'View trip'}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="text-muted-foreground mt-0.5">No itinerary linked</p>
                  )}
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Status
                  </span>
                  <select
                    value={selectedBooking.status}
                    disabled={savingStatusId === selectedBooking.id}
                    onChange={(e) =>
                      void handleStatusChange(selectedBooking.id, e.target.value as Booking['status'])
                    }
                    className={`w-full rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] font-bold uppercase ${statusBadgeClass(selectedBooking.status)}`}
                  >
                    {BOOKING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedInvoice && (
                  <div>
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      Billing
                    </span>
                    <Link
                      href={`/dashboard/finance?openInvoice=${selectedInvoice.id}`}
                      className="inline-flex items-center gap-1.5 mt-1 font-semibold text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {selectedInvoice.invoiceNumber} · ₹{Number(selectedInvoice.amount).toLocaleString('en-IN')}
                    </Link>
                  </div>
                )}
                {(selectedBooking.driverName ||
                  selectedBooking.visaStatus ||
                  selectedBooking.hotelConfirmationCode) && (
                  <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
                    <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      Operations
                    </span>
                    {selectedBooking.driverName && (
                      <p>
                        <span className="text-muted-foreground">Driver:</span>{' '}
                        {selectedBooking.driverName}
                        {selectedBooking.driverPhone ? ` · ${selectedBooking.driverPhone}` : ''}
                      </p>
                    )}
                    {selectedBooking.visaStatus && (
                      <p>
                        <span className="text-muted-foreground">Visa:</span> {selectedBooking.visaStatus}
                      </p>
                    )}
                    {selectedBooking.hotelConfirmationCode && (
                      <p>
                        <span className="text-muted-foreground">Hotel conf.:</span>{' '}
                        {selectedBooking.hotelConfirmationCode}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground space-y-2">
              <ClipboardList className="w-8 h-8 mx-auto opacity-40" />
              <p>Select a booking row to view traveller, trip, and billing details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
