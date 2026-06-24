import { bindCrmListFetch } from "@/lib/api/pagination";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
import { applyLeadRecord, listLeads, loadLeadExtras, type ApiLeadListRead } from "@/lib/api/leads";
import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import { listExpenses, listInvoices, mapExpenseFromApi, mapInvoiceFromApi } from "@/lib/api/finance";
import { listVendors, mapVendorFromApi } from "@/lib/api/vendors";
import { listItineraries, mapItineraryFromApi } from "@/lib/api/itineraries";
import { listAuditLogs, mapAuditLogFromApi, type ApiAuditLogRead } from "@/lib/api/audit-logs";
import { userNameMap } from "@/lib/api/users";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { CRM_CACHE } from "@/lib/api/crm-workspace-store";
import { loadStaffDirectory } from "@/lib/api/staff-directory";

const prefetched = new Set<string>();

export function prefetchStaffDirectory(): void {
  const key = CRM_CACHE.staff;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void loadStaffDirectory().catch(() => {
    prefetched.delete(key);
  });
}

/** Warm common CRM lists in the background (nav hover / shell mount). */
export function prefetchCrmModule(cacheKey: string): void {
  if (prefetched.has(cacheKey)) return;
  prefetched.add(cacheKey);

  void (async () => {
    try {
      switch (cacheKey) {
        case CRM_CACHE.leads: {
          const extras = loadLeadExtras();
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.leads,
            fetchPage: bindCrmListFetch(listLeads),
            mapItem: (item) => applyLeadRecord(item as ApiLeadListRead, {}, extras),
          });
          break;
        }
        case CRM_CACHE.customers:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.customers,
            fetchPage: bindCrmListFetch(listCustomers),
            mapItem: mapCustomerFromApi,
          });
          break;
        case CRM_CACHE.bookings:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.bookings,
            fetchPage: bindCrmListFetch(listBookings),
            mapItem: mapBookingFromApi,
          });
          break;
        case CRM_CACHE.vendors:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.vendors,
            fetchPage: bindCrmListFetch(listVendors),
            mapItem: mapVendorFromApi,
          });
          break;
        case CRM_CACHE.invoices:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.invoices,
            fetchPage: bindCrmListFetch(listInvoices),
            mapItem: mapInvoiceFromApi,
          });
          break;
        case CRM_CACHE.expenses:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.expenses,
            fetchPage: bindCrmListFetch(listExpenses),
            mapItem: mapExpenseFromApi,
          });
          break;
        case CRM_CACHE.itineraries:
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.itineraries,
            fetchPage: bindCrmListFetch(listItineraries),
            mapItem: mapItineraryFromApi,
          });
          break;
        case CRM_CACHE.auditLogs: {
          const staff = await loadStaffDirectory();
          const names = userNameMap(staff);
          await loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.auditLogs,
            fetchPage: bindCrmListFetch(listAuditLogs),
            mapItem: (item) => mapAuditLogFromApi(item as ApiAuditLogRead, names),
          });
          break;
        }
        default:
          prefetched.delete(cacheKey);
      }
    } catch {
      prefetched.delete(cacheKey);
    }
  })();
}

export function prefetchCrmNavRoute(href: string): void {
  if (href === "/dashboard" || href.endsWith("/dashboard")) {
    prefetchCrmModule(CRM_CACHE.leads);
    prefetchCrmModule(CRM_CACHE.invoices);
    return;
  }
  if (href.includes("/crm")) prefetchCrmModule(CRM_CACHE.leads);
  else if (href.includes("/customers")) prefetchCrmModule(CRM_CACHE.customers);
  else if (href.includes("/bookings")) {
    prefetchCrmModule(CRM_CACHE.bookings);
    prefetchCrmModule(CRM_CACHE.customers);
    prefetchCrmModule(CRM_CACHE.itineraries);
    prefetchCrmModule(CRM_CACHE.invoices);
  }
  else if (href.includes("/vendors")) prefetchCrmModule(CRM_CACHE.vendors);
  else if (href.includes("/finance")) {
    prefetchCrmModule(CRM_CACHE.invoices);
    prefetchCrmModule(CRM_CACHE.expenses);
  } else if (href.includes("/itinerary")) prefetchCrmModule(CRM_CACHE.itineraries);
  else if (href.includes("/employees")) {
    prefetchStaffDirectory();
    prefetchCrmModule(CRM_CACHE.auditLogs);
  }
}
