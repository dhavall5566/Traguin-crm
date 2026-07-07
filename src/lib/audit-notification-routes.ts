import type { AuditLog } from '@/lib/store';

/** Deep-link targets for CRM notification / audit entries. */
export function getAuditNotificationHref(log: AuditLog): string | null {
  const entityId = log.entityId?.trim();

  switch (log.entityType) {
    case 'Lead':
      return entityId ? `/dashboard/crm?openLead=${encodeURIComponent(entityId)}` : null;
    case 'Itinerary':
      return entityId ? `/dashboard/itinerary?openPlan=${encodeURIComponent(entityId)}` : null;
    case 'Customer':
      return entityId ? `/dashboard/customers?openCustomer=${encodeURIComponent(entityId)}` : null;
    case 'Booking':
      return entityId ? `/dashboard/bookings?openBooking=${encodeURIComponent(entityId)}` : null;
    case 'Invoice':
      return entityId ? `/dashboard/finance?openInvoice=${encodeURIComponent(entityId)}` : null;
    case 'Vendor':
      return entityId ? `/dashboard/vendors?openVendor=${encodeURIComponent(entityId)}` : null;
    case 'User':
      return entityId ? `/dashboard/employees?openUser=${encodeURIComponent(entityId)}` : null;
    case 'Expense':
      return '/dashboard/finance?tab=expenses';
    case 'VendorPayout':
      return '/dashboard/finance?tab=payouts';
    case 'Payment':
      return '/dashboard/finance?tab=invoices';
    case 'AgencySmtpSettings':
      return '/dashboard/settings/smtp';
    default:
      return null;
  }
}

export function isAuditNotificationClickable(log: AuditLog): boolean {
  return getAuditNotificationHref(log) !== null;
}

/** Shorten raw UUIDs in audit copy for scan-friendly display. */
export function formatAuditLogDetails(details: string): string {
  return details.replace(
    /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    '#$1',
  );
}
