import { create } from 'zustand';
import { mapApiAgency, mapApiUser } from '@/lib/api/crm-client';
import {
  clearSessionCache,
  readSessionCache,
  writeSessionCache,
} from '@/lib/session-cache';
import {
  RBAC_DEFINITIONS_STORAGE_KEY,
  RBAC_MODULE_DEFS,
  createDefaultRoleDefinitionsForAgency,
  duplicateRolePermissions,
  permissionsAllDenied,
  type RoleDefinition,
  type RbacModuleKey,
  type RbacCrudSet,
} from '@/lib/rbac';

export type { RoleDefinition, RbacModuleKey, RbacCrudSet } from '@/lib/rbac';

/** Stable unique ids even when multiple entities are created in the same millisecond. */
function uniqueEntityId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${typeof performance !== 'undefined' ? performance.now() : Date.now()}`;
  return `${prefix}-${suffix}`;
}

// Types aligning with Prisma Schema
export interface Agency {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  subscriptionPlan: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  agencyId: string;
  role: string; // Admin, Sales, Operations, Finance, Vendor, Customer
}

export interface Lead {
  id: string;
  agencyId: string;
  title: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: 'NEW' | 'CONTACTED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'CONFIRMED' | 'LOST';
  value: number;
  source?: string;
  assignedToId?: string;
  customerId?: string;
  /** Preferred proposal / itinerary for this lead (conversion card). */
  proposalItineraryId?: string;
  createdAt: string;
  updatedAt: string;
  /** Set by backend when status enters PROPOSAL_SENT (canonical stuck-proposal anchor). */
  proposalSentAt?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'EMAIL' | 'PHONE' | 'NOTE' | 'STAGE_CHANGE' | 'MEET' | 'ENTERED_PROPOSAL_SENT';
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface LeadFollowup {
  id: string;
  leadId: string;
  scheduledAt: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdBy: string;
}

export interface Customer {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passportNumber?: string;
  passportExpiry?: string;
  travelHistory: string[];
  documents: { name: string; url: string; category: string; size: string }[];
}

export interface ItineraryItem {
  id: string;
  type: 'FLIGHT' | 'HOTEL' | 'TRANSFER' | 'ACTIVITY' | 'MEAL' | 'NOTE';
  title: string;
  details: string;
  costPrice: number;
  sellingPrice: number;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  items: ItineraryItem[];
}

export interface Itinerary {
  id: string;
  agencyId: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  totalPrice: number;
  markupMargin: number; // percentage
  taxRate: number; // percentage
  isTemplate: boolean;
  days: ItineraryDay[];
  proposalTheme?: 'luxury' | 'classic' | 'emerald' | 'sunset';
}

export interface VendorRate {
  id: string;
  rate: number;
  seasonStart: string;
  seasonEnd: string;
}

export interface Vendor {
  id: string;
  agencyId: string;
  name: string;
  type: 'SERVICE' | 'PACKAGE';
  email: string;
  phone: string;
  address: string;
  ledgerBalance: number;
  rates: { name: string; type: string; price: number }[];
}

export interface Booking {
  id: string;
  agencyId: string;
  customerId: string;
  itineraryId?: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  voucherUrl?: string;
  ticketUrl?: string;
  hotelConfirmationCode?: string;
  driverName?: string;
  driverPhone?: string;
  visaStatus?: string;
  createdAt: string;
  /** Lead / CRM guest name when `customerId` is not linked to Directory yet */
  guestFirstName?: string;
  guestLastName?: string;
}

/** Display name on invoices and ops views — prefers Directory profile, else CRM guest snapshot */
export function bookingTravellerLabel(booking: Booking | undefined | null, customers: Customer[]): string {
  if (!booking) return '—';
  const cid = (booking.customerId || '').trim();
  if (cid) {
    const c = customers.find((x) => x.id === booking.customerId);
    if (c) {
      const n = `${c.firstName} ${c.lastName}`.trim();
      return n || 'Unknown';
    }
  }
  const g = [booking.guestFirstName, booking.guestLastName].filter(Boolean).join(' ').trim();
  return g || 'Unknown';
}

export interface Invoice {
  id: string;
  agencyId: string;
  bookingId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

export interface Payment {
  id: string;
  agencyId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
  paymentDate: string;
}

export interface Expense {
  id: string;
  agencyId: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
}

export interface VendorPayout {
  id: string;
  agencyId: string;
  vendorId: string;
  amount: number;
  paymentDate: string;
}

export interface AuditLog {
  id: string;
  agencyId: string;
  userName: string;
  action: string;
  entityType: string;
  details: string;
  createdAt: string;
}

/** Workspace UX + finance defaults (persisted via setWorkspacePreferences). */
export interface WorkspacePreferences {
  defaultInvoiceDueDays: number;
  sidebarCompact: boolean;
  densePagePadding: boolean;
}

export const WORKSPACE_PREFS_STORAGE_KEY = 'travelcrm:workspacePrefs';

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  defaultInvoiceDueDays: 30,
  sidebarCompact: false,
  densePagePadding: false,
};

// Zustand Store State Definition
interface CRMStore {
  // Current session & multi-tenant active profile
  agencies: Agency[];
  currentAgency: Agency;
  currentUser: User | null;
  authStatus: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  users: User[];
  
  // Data lists
  leads: Lead[];
  leadNotes: LeadNote[];
  leadActivities: LeadActivity[];
  leadFollowups: LeadFollowup[];
  customers: Customer[];
  itineraries: Itinerary[];
  vendors: Vendor[];
  bookings: Booking[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  vendorPayouts: VendorPayout[];
  auditLogs: AuditLog[];

  // Theme state
  theme: 'light' | 'dark';
  workspacePreferences: WorkspacePreferences;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setWorkspacePreferences: (partial: Partial<WorkspacePreferences>) => void;
  resetWorkspacePreferences: () => void;
  setCurrentAgency: (agencyId: string) => void;
  setCurrentUser: (user: User | null) => void;
  setSessionFromApi: (user: User, agency: Agency) => void;
  hydrateSession: () => Promise<void>;
  clearAuthSession: () => void;
  registerAgency: (agencyName: string, subdomain: string, adminName: string, email: string) => Agency;

  // Lead actions
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'agencyId'>) => void;
  updateLeadStatus: (leadId: string, status: Lead['status']) => void;
  updateLead: (leadId: string, updates: Partial<Lead>) => void;
  deleteLead: (leadId: string) => void;
  addLeadNote: (leadId: string, content: string) => void;
  addLeadFollowup: (leadId: string, scheduledAt: string, notes: string) => void;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'agencyId' | 'documents' | 'travelHistory'>) => Customer;
  updateCustomer: (customerId: string, updates: Partial<Customer>) => void;
  uploadCustomerDoc: (customerId: string, doc: { name: string; category: string; size: string }) => void;

  // Itinerary actions
  addItinerary: (itinerary: Omit<Itinerary, 'id' | 'agencyId'>) => Itinerary;
  updateItinerary: (itineraryId: string, updates: Partial<Itinerary>) => void;
  deleteItinerary: (itineraryId: string) => void;
  /** Adds a day and recomputes totals; returns the new day id, or empty string if the plan was not found. */
  addItineraryDay: (itineraryId: string, title: string, description: string) => string;
  updateItineraryDay: (itineraryId: string, dayId: string, updates: Partial<ItineraryDay>) => void;
  deleteItineraryDay: (itineraryId: string, dayId: string) => void;
  addItineraryItem: (itineraryId: string, dayId: string, item: Omit<ItineraryItem, 'id'>) => void;
  updateItineraryItem: (itineraryId: string, dayId: string, itemId: string, updates: Partial<ItineraryItem>) => void;
  deleteItineraryItem: (itineraryId: string, dayId: string, itemId: string) => void;
  reorderItineraryDays: (itineraryId: string, days: ItineraryDay[]) => void;

  // Booking actions
  createBooking: (
    customerId: string,
    itineraryId: string,
    guestFromLead?: { firstName?: string; lastName?: string },
  ) => Booking;
  updateBooking: (bookingId: string, updates: Partial<Booking>) => void;

  // Finance actions
  createInvoice: (bookingId: string, amount: number, dueDate: string) => void;
  recordPayment: (invoiceId: string, amount: number, method: string, ref?: string) => void;
  recordExpense: (amount: number, category: string, description: string) => void;
  recordVendorPayout: (vendorId: string, amount: number) => void;

  // Vendor actions
  addVendor: (vendor: Omit<Vendor, 'id' | 'agencyId' | 'ledgerBalance'>) => void;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => void;

  // Audit helper
  logAction: (action: string, entityType: string, details: string) => void;

  /** RBAC templates per agency (`User.role` must match `RoleDefinition.name`). */
  roleDefinitions: RoleDefinition[];
  addRoleDefinition: (
    roleName: string,
    cloneFromRoleId?: string | null,
  ) => RoleDefinition | null;
  deleteRoleDefinition: (roleId: string) => boolean;
  renameRoleDefinition: (roleId: string, nextName: string) => boolean;
  setRoleModulePermission: (
    roleId: string,
    module: RbacModuleKey,
    permission: keyof RbacCrudSet,
    value: boolean,
  ) => void;
}

// Initial Seed Data
const defaultAgencies: Agency[] = [
  {
    id: 'agency-1',
    name: 'Bharat Travel Solutions',
    subdomain: 'bharattravel',
    logoUrl: '/agency-logo.svg',
    primaryColor: '#0d6efd', // Bootstrap primary blue
    secondaryColor: '#6c757d', // Bootstrap secondary gray
    subscriptionPlan: 'GROWTH',
  },
];

const defaultUsers: User[] = [
  { id: 'user-admin', email: 'admin@bharattravel.in', name: 'Dhruv Shah', agencyId: 'agency-1', role: 'Agency Admin' },
  { id: 'user-sales', email: 'sales@bharattravel.in', name: 'Neha Kapoor', agencyId: 'agency-1', role: 'Sales Agent' },
  { id: 'user-ops', email: 'ops@bharattravel.in', name: 'Arjun Nair', agencyId: 'agency-1', role: 'Operations' },
  { id: 'user-finance', email: 'finance@bharattravel.in', name: 'Kavya Rao', agencyId: 'agency-1', role: 'Finance' },
  { id: 'user-vendor', email: 'reservations@dalviewretreat.in', name: 'Faisal Mir', agencyId: 'agency-1', role: 'Vendor' },
  { id: 'user-customer', email: 'aarav.mehta@gmail.com', name: 'Aarav Mehta', agencyId: 'agency-1', role: 'Customer' },
];

const defaultCustomers: Customer[] = [
  {
    id: 'cust-1',
    agencyId: 'agency-1',
    firstName: 'Aarav',
    lastName: 'Mehta',
    email: 'aarav.mehta@gmail.com',
    phone: '+91 98765 43210',
    passportNumber: 'N8765432',
    passportExpiry: '2031-10-15',
    travelHistory: ['Jaipur, Rajasthan (2024)', 'Kochi, Kerala (2025)'],
    documents: [
      { name: 'passport_scan.pdf', url: '#', category: 'Passport', size: '1.2 MB' },
      { name: 'kashmir_permit.pdf', url: '#', category: 'Permit', size: '840 KB' }
    ]
  },
  {
    id: 'cust-2',
    agencyId: 'agency-1',
    firstName: 'Priya',
    lastName: 'Iyer',
    email: 'priya.iyer@gmail.com',
    phone: '+91 99887 77665',
    passportNumber: 'P1234567',
    passportExpiry: '2029-04-12',
    travelHistory: ['Hampi, Karnataka (2023)', 'Darjeeling, West Bengal (2024)'],
    documents: [
      { name: 'passport_priya.pdf', url: '#', category: 'Passport', size: '2.1 MB' }
    ]
  },
  {
    id: 'cust-3',
    agencyId: 'agency-1',
    firstName: 'Ananya',
    lastName: 'Menon',
    email: 'ananya.menon@gmail.com',
    phone: '+91 94470 55667',
    passportNumber: 'K4455667',
    passportExpiry: '2030-02-01',
    travelHistory: ['Munnar (2025)'],
    documents: [{ name: 'id_proof.pdf', url: '#', category: 'ID', size: '400 KB' }],
  },
  {
    id: 'cust-4',
    agencyId: 'agency-1',
    firstName: 'Rohan',
    lastName: 'Singh',
    email: 'rohan.singh@gmail.com',
    phone: '+91 98110 22334',
    passportNumber: 'R9988776',
    passportExpiry: '2028-09-01',
    travelHistory: ['Jaisalmer (2024)'],
    documents: [{ name: 'passport_rohan.pdf', url: '#', category: 'Passport', size: '1.1 MB' }],
  },
  {
    id: 'cust-5',
    agencyId: 'agency-1',
    firstName: 'Ishaan',
    lastName: 'Banerjee',
    email: 'ishaan.banerjee@gmail.com',
    phone: '+91 98300 77889',
    passportNumber: 'I1122334',
    passportExpiry: '2032-06-01',
    travelHistory: ['Sarnath day trip (2025)'],
    documents: [{ name: 'passport_ishaan.pdf', url: '#', category: 'Passport', size: '900 KB' }],
  },
];

const defaultLeads: Lead[] = [
  {
    id: 'lead-1',
    agencyId: 'agency-1',
    title: 'Kashmir Honeymoon Escape 6D',
    firstName: 'Aarav',
    lastName: 'Mehta',
    email: 'aarav.mehta@gmail.com',
    phone: '+91 98765 43210',
    status: 'PROPOSAL_SENT',
    value: 285000.00,
    source: 'Website Quote',
    assignedToId: 'user-sales',
    customerId: 'cust-1',
    proposalItineraryId: 'itin-1',
    createdAt: '2026-05-10T14:32:00Z',
    updatedAt: '2026-05-22T12:00:00Z',
  },
  {
    id: 'lead-2',
    agencyId: 'agency-1',
    title: 'Rajasthan Heritage Circuit 8D',
    firstName: 'Rohan',
    lastName: 'Singh',
    email: 'rohan.singh@gmail.com',
    phone: '+91 98110 22334',
    status: 'NEW',
    value: 198000.00,
    source: 'Referral',
    assignedToId: 'user-sales',
    customerId: 'cust-4',
    proposalItineraryId: 'itin-2',
    createdAt: '2026-05-21T09:15:00Z',
    updatedAt: '2026-05-21T09:15:00Z',
  },
  {
    id: 'lead-3',
    agencyId: 'agency-1',
    title: 'Kerala Backwater Retreat',
    firstName: 'Ananya',
    lastName: 'Menon',
    email: 'ananya.menon@gmail.com',
    phone: '+91 94470 55667',
    status: 'NEGOTIATION',
    value: 164000.00,
    source: 'Instagram Ads',
    assignedToId: 'user-sales',
    customerId: 'cust-3',
    proposalItineraryId: 'itin-3',
    createdAt: '2026-05-15T11:00:00Z',
    updatedAt: '2026-05-22T08:30:00Z',
  },
  {
    id: 'lead-4',
    agencyId: 'agency-1',
    title: 'Varanasi Spiritual Trail',
    firstName: 'Ishaan',
    lastName: 'Banerjee',
    email: 'ishaan.banerjee@gmail.com',
    phone: '+91 98300 77889',
    status: 'CONFIRMED',
    value: 112000.00,
    source: 'Google Search',
    assignedToId: 'user-sales',
    customerId: 'cust-5',
    proposalItineraryId: 'itin-4',
    createdAt: '2026-05-02T10:45:00Z',
    updatedAt: '2026-05-18T16:20:00Z',
  },
  {
    id: 'lead-5',
    agencyId: 'agency-1',
    title: 'Spiti Valley Photography Fixed Departure',
    firstName: 'Kavya',
    lastName: 'Reddy',
    email: 'kavya.reddy@gmail.com',
    phone: '+91 99001 55678',
    status: 'CONTACTED',
    value: 245000.0,
    source: 'WhatsApp Broadcast',
    assignedToId: 'user-sales',
    createdAt: '2026-05-23T08:00:00Z',
    updatedAt: '2026-05-24T11:00:00Z',
  },
];

const defaultLeadActivities: LeadActivity[] = [
  { id: 'act-ps-1', leadId: 'lead-1', type: 'STAGE_CHANGE', description: 'Moved stage from NEW to PROPOSAL_SENT', createdBy: 'Neha Kapoor', createdAt: '2026-05-10T15:05:00Z' },
  { id: 'act-1', leadId: 'lead-1', type: 'NOTE', description: 'Interested in a Dal Lake houseboat night and a private Gulmarg snow day.', createdBy: 'Neha Kapoor', createdAt: '2026-05-10T14:35:00Z' },
  { id: 'act-2', leadId: 'lead-1', type: 'EMAIL', description: 'Sent the first Kashmir itinerary draft with flight quotes.', createdBy: 'Neha Kapoor', createdAt: '2026-05-12T16:00:00Z' },
  { id: 'act-3', leadId: 'lead-1', type: 'PHONE', description: 'Discussed markup options. Client requested a private shikara dinner.', createdBy: 'Neha Kapoor', createdAt: '2026-05-22T11:00:00Z' },
  { id: 'act-4', leadId: 'lead-2', type: 'EMAIL', description: 'Shared Rajasthan Palaces & Dunes draft with Jodhpur–Jaisalmer pacing.', createdBy: 'Neha Kapoor', createdAt: '2026-05-21T10:00:00Z' },
  { id: 'act-5', leadId: 'lead-3', type: 'MEET', description: 'Video walkthrough of Alleppey houseboat night + Kumarakom bird sanctuary add-on.', createdBy: 'Neha Kapoor', createdAt: '2026-05-16T13:20:00Z' },
  { id: 'act-6', leadId: 'lead-3', type: 'STAGE_CHANGE', description: 'Moved stage from PROPOSAL_SENT to NEGOTIATION', createdBy: 'Neha Kapoor', createdAt: '2026-05-20T09:00:00Z' },
  { id: 'act-7', leadId: 'lead-4', type: 'PHONE', description: 'Confirmed Ganga aarti slot and boat ride timing for family of three.', createdBy: 'Neha Kapoor', createdAt: '2026-05-18T16:25:00Z' },
  { id: 'act-8', leadId: 'lead-5', type: 'NOTE', description: 'Interested in June fixed departure; asked about oxygen support and photography permits.', createdBy: 'Neha Kapoor', createdAt: '2026-05-23T14:10:00Z' },
];

const defaultLeadNotes: LeadNote[] = [
  { id: 'note-1', leadId: 'lead-1', content: 'Client prefers morning departures. Budget is flexible for a premium Srinagar stay.', createdBy: 'Neha Kapoor', createdAt: '2026-05-10T14:40:00Z' },
  { id: 'note-2', leadId: 'lead-2', content: 'Wants heritage hotels where possible; ok with one night desert camp.', createdBy: 'Neha Kapoor', createdAt: '2026-05-21T09:40:00Z' },
  { id: 'note-3', leadId: 'lead-4', content: 'Vegetarian meals only; no early flights on weekends.', createdBy: 'Neha Kapoor', createdAt: '2026-05-12T08:15:00Z' },
];

const defaultLeadFollowups: LeadFollowup[] = [
  { id: 'fup-1', leadId: 'lead-1', scheduledAt: '2026-05-25T10:00:00Z', status: 'PENDING', notes: 'Call client to review final pricing and confirm the advance payment.', createdBy: 'Neha Kapoor' },
  { id: 'fup-2', leadId: 'lead-2', scheduledAt: '2026-05-27T11:30:00Z', status: 'PENDING', notes: 'Follow up on revised Udaipur palace hotel quote.', createdBy: 'Neha Kapoor' },
  { id: 'fup-3', leadId: 'lead-3', scheduledAt: '2026-05-24T16:00:00Z', status: 'PENDING', notes: 'Send houseboat deck plan and final GST-inclusive total.', createdBy: 'Neha Kapoor' },
  { id: 'fup-4', leadId: 'lead-4', scheduledAt: '2026-05-19T12:00:00Z', status: 'COMPLETED', notes: 'Deposit link shared; acknowledged.', createdBy: 'Neha Kapoor' },
  { id: 'fup-5', leadId: 'lead-5', scheduledAt: '2026-05-28T09:00:00Z', status: 'PENDING', notes: 'Share Spiti batch dates and inclusions PDF.', createdBy: 'Neha Kapoor' },
];

const defaultVendors: Vendor[] = [
  {
    id: 'vend-1',
    agencyId: 'agency-1',
    name: 'Dal View Retreat Srinagar',
    type: 'SERVICE',
    email: 'reservations@dalviewretreat.in',
    phone: '+91 194 245 7788',
    address: 'Boulevard Road, Srinagar, Jammu and Kashmir',
    ledgerBalance: 96000.00,
    rates: [
      { name: 'Lake View Deluxe Room', type: 'HOTEL', price: 14000 },
      { name: 'Premium Houseboat Suite', type: 'HOTEL', price: 22000 }
    ]
  },
  {
    id: 'vend-2',
    agencyId: 'agency-1',
    name: 'IndiGo Agency Desk',
    type: 'SERVICE',
    email: 'agencydesk@goindigo.in',
    phone: '+91 124 617 3838',
    address: 'Gurugram, Haryana',
    ledgerBalance: 54000.00,
    rates: [
      { name: 'DEL-SXR Flexi Return', type: 'FLIGHT', price: 28000 },
      { name: 'BOM-SXR Economy Return', type: 'FLIGHT', price: 18500 }
    ]
  },
  {
    id: 'vend-3',
    agencyId: 'agency-1',
    name: 'Kashmir Valley Cabs',
    type: 'SERVICE',
    email: 'bookings@kashmirvalleycabs.in',
    phone: '+91 99065 44321',
    address: 'Rajbagh, Srinagar, Jammu and Kashmir',
    ledgerBalance: 18000.00,
    rates: [
      { name: 'Full-Day Innova Crysta (10h)', type: 'VEHICLE', price: 6500 },
      { name: 'Srinagar Airport SUV Transfer', type: 'VEHICLE', price: 2200 }
    ]
  },
  {
    id: 'vend-4',
    agencyId: 'agency-1',
    name: 'Alleppey Houseboat Collective',
    type: 'SERVICE',
    email: 'charter@alleppeyhouseboats.in',
    phone: '+91 477 226 8890',
    address: 'Finishing Point Road, Alappuzha, Kerala',
    ledgerBalance: 42000.0,
    rates: [
      { name: 'Premium AC Houseboat (1 night)', type: 'HOTEL', price: 14500 },
      { name: 'Shikara sunset cruise (2h)', type: 'ACTIVITY', price: 2200 },
    ],
  },
  {
    id: 'vend-5',
    agencyId: 'agency-1',
    name: 'South Goa Boutique Stays',
    type: 'SERVICE',
    email: 'reservations@southgoaboutique.in',
    phone: '+91 832 271 4400',
    address: 'Palolem, South Goa',
    ledgerBalance: 28500.0,
    rates: [
      { name: 'Garden Villa (B&B)', type: 'HOTEL', price: 9800 },
      { name: 'Airport–South Goa sedan', type: 'VEHICLE', price: 1800 },
    ],
  },
];

const defaultItineraries: Itinerary[] = [
  {
    id: 'itin-1',
    agencyId: 'agency-1',
    title: 'Signature Kashmir Luxury Discovery',
    description: 'A hand-crafted Kashmir escape covering Dal Lake, Gulmarg views, Srinagar gardens, and warm local hospitality.',
    startDate: '2026-07-15',
    endDate: '2026-07-22',
    customerId: 'cust-1',
    status: 'SENT',
    totalPrice: 285000.00,
    markupMargin: 15.00,
    taxRate: 10.00,
    isTemplate: false,
    proposalTheme: 'luxury',
    days: [
      {
        id: 'day-1',
        dayNumber: 1,
        title: 'Arrival & Dal Lake Welcome',
        description: 'Arrive at Srinagar Airport, meet your private host, and transfer to your Dal Lake retreat.',
        items: [
          { id: 'item-1', type: 'FLIGHT', title: 'IndiGo 6E DEL-SXR Return', details: 'Flexi fare, seats 12A and 12B', costPrice: 28000, sellingPrice: 32000 },
          { id: 'item-2', type: 'TRANSFER', title: 'Srinagar Airport Welcome & Private SUV Transfer', details: 'Driver Name: Imtiyaz. Signboard: MEHTA FAMILY', costPrice: 2200, sellingPrice: 3200 },
          { id: 'item-3', type: 'HOTEL', title: 'Dal View Retreat Srinagar', details: 'Lake View Deluxe Room (1 Room, 5 Nights)', costPrice: 70000, sellingPrice: 84000 }
        ]
      },
      {
        id: 'day-2',
        dayNumber: 2,
        title: 'Gulmarg Meadows & Gondola',
        description: 'Explore Gulmarg with a private vehicle, local guide, and gondola assistance.',
        items: [
          { id: 'item-4', type: 'TRANSFER', title: 'Full-Day Innova Crysta Chauffeur Tour', details: 'Private vehicle for Srinagar to Gulmarg sightseeing', costPrice: 6500, sellingPrice: 8200 },
          { id: 'item-5', type: 'ACTIVITY', title: 'Gulmarg Gondola & Local Guide Support', details: 'Phase 1 tickets and local English-speaking guide included', costPrice: 7600, sellingPrice: 9800 }
        ]
      }
    ]
  },
  {
    id: 'itin-2',
    agencyId: 'agency-1',
    title: 'Rajasthan Palaces & Dunes VIP',
    description: 'Eight-day circuit through Udaipur blues, Jodhpur forts, Jaisalmer dunes, and Jaipur havelis — private drivers throughout.',
    startDate: '2026-08-03',
    endDate: '2026-08-11',
    customerId: 'cust-4',
    status: 'DRAFT',
    totalPrice: 131560.0,
    markupMargin: 15.0,
    taxRate: 10.0,
    isTemplate: false,
    proposalTheme: 'emerald',
    days: [
      {
        id: 'it2-day-1',
        dayNumber: 1,
        title: 'Lake Arrival in Udaipur',
        description: 'Fly into Udaipur and settle into a palace-view stay.',
        items: [
          { id: 'it2-i1', type: 'FLIGHT', title: 'Connecting into Udaipur', details: 'Economy, flexible date change', costPrice: 9200, sellingPrice: 11800 },
          { id: 'it2-i2', type: 'TRANSFER', title: 'Maharana Pratap Airport sedan', details: 'Hotel meet & greet', costPrice: 850, sellingPrice: 2800 },
          {
            id: 'it2-i3',
            type: 'HOTEL',
            title: 'City-facing heritage suite',
            details: 'Udaipur — 2 nights palace zone',
            costPrice: 19500,
            sellingPrice: 35400,
          },
        ],
      },
      {
        id: 'it2-day-2',
        dayNumber: 2,
        title: 'City of Lakes',
        description: 'Boat ride, palace tour, and sundowner on the roof.',
        items: [
          {
            id: 'it2-i4',
            type: 'ACTIVITY',
            title: 'Private Lake Pichola cruise + City Palace',
            details: 'English guide + bottled water',
            costPrice: 7800,
            sellingPrice: 14800,
          },
          { id: 'it2-i5', type: 'MEAL', title: 'Courtyard thali dinner', details: 'Royal veg / non-veg options', costPrice: 2800, sellingPrice: 5600 },
        ],
      },
      {
        id: 'it2-day-3',
        dayNumber: 3,
        title: 'Road to the Blue City',
        description: 'Scenic drive to Jodhpur with Mehrangarh preview.',
        items: [
          {
            id: 'it2-i6',
            type: 'TRANSFER',
            title: 'Udaipur → Jodhpur private Innova',
            details: '~5h with lunch stop',
            costPrice: 7200,
            sellingPrice: 11800,
          },
          { id: 'it2-i7', type: 'HOTEL', title: 'Old city haveli stay', details: 'Jodhpur — 2 nights', costPrice: 11200, sellingPrice: 22400 },
        ],
      },
    ],
  },
  {
    id: 'itin-3',
    agencyId: 'agency-1',
    title: 'Kerala Alleppey Slow Lane',
    description: 'A hand-paced backwater escape: premium houseboat night, Kumarakom bird trails, and Cochin heritage walk.',
    startDate: '2026-09-05',
    endDate: '2026-09-08',
    customerId: 'cust-3',
    status: 'SENT',
    totalPrice: 164000.0,
    markupMargin: 15.0,
    taxRate: 10.0,
    isTemplate: false,
    proposalTheme: 'classic',
    days: [
      {
        id: 'it3-day-1',
        dayNumber: 1,
        title: 'Cochin touch-down',
        description: 'Arrive, relax, and evening heritage lane walk.',
        items: [
          { id: 'it3-i1', type: 'FLIGHT', title: 'BOM–COK return window', details: 'Mid-morning preferred', costPrice: 7200, sellingPrice: 9800 },
          { id: 'it3-i2', type: 'TRANSFER', title: 'Airport to Fort Kochi', details: 'SUV with AC', costPrice: 900, sellingPrice: 2400 },
          {
            id: 'it3-i3',
            type: 'HOTEL',
            title: 'Boutique stay — Fort Kochi',
            details: '1 night, breakfast included',
            costPrice: 6800,
            sellingPrice: 11200,
          },
        ],
      },
      {
        id: 'it3-day-2',
        dayNumber: 2,
        title: 'Houseboat night',
        description: 'Board your AC houseboat and glide through the canals.',
        items: [
          {
            id: 'it3-i4',
            type: 'HOTEL',
            title: 'Premium AC houseboat (alleppey)',
            details: 'Full board, private deck',
            costPrice: 22000,
            sellingPrice: 35800,
          },
          {
            id: 'it3-i5',
            type: 'ACTIVITY',
            title: 'Shikara sunset + village stop',
            details: '2h with local snacks',
            costPrice: 1600,
            sellingPrice: 4200,
          },
        ],
      },
      {
        id: 'it3-day-3',
        dayNumber: 3,
        title: 'Kumarakom wind-down',
        description: 'Bird sanctuary walk and lazy pool afternoon.',
        items: [
          {
            id: 'it3-i6',
            type: 'TRANSFER',
            title: 'Alleppey → Kumarakom resort',
            details: 'Private sedan',
            costPrice: 1800,
            sellingPrice: 3500,
          },
          {
            id: 'it3-i7',
            type: 'ACTIVITY',
            title: 'Guided sanctuary boardwalk',
            details: 'Early morning, naturalist',
            costPrice: 1200,
            sellingPrice: 2800,
          },
        ],
      },
    ],
  },
  {
    id: 'itin-4',
    agencyId: 'agency-1',
    title: 'Goa Monsoon Long Weekend',
    description: 'South Goa quiet beaches, spice plantation lunch, and one lazy pool day before flying out.',
    startDate: '2026-07-24',
    endDate: '2026-07-27',
    customerId: 'cust-5',
    status: 'APPROVED',
    totalPrice: 112000.0,
    markupMargin: 12.0,
    taxRate: 8.0,
    isTemplate: false,
    proposalTheme: 'sunset',
    days: [
      {
        id: 'it4-day-1',
        dayNumber: 1,
        title: 'Touch the coast',
        description: 'Land in Goa and slip into a garden villa.',
        items: [
          { id: 'it4-i1', type: 'FLIGHT', title: 'DEL–GOI / return flex', details: 'Weekend slots', costPrice: 6200, sellingPrice: 8900 },
          { id: 'it4-i2', type: 'TRANSFER', title: 'Dabolim to Palolem', details: 'Sedan, monsoon-safe driver', costPrice: 1400, sellingPrice: 2900 },
          {
            id: 'it4-i3',
            type: 'HOTEL',
            title: 'South Goa boutique — garden villa',
            details: '3 nights B&B',
            costPrice: 16800,
            sellingPrice: 26600,
          },
        ],
      },
      {
        id: 'it4-day-2',
        dayNumber: 2,
        title: 'Spice & rain',
        description: 'Plantation tour and beach walk when skies clear.',
        items: [
          {
            id: 'it4-i4',
            type: 'ACTIVITY',
            title: 'Spice plantation lunch experience',
            details: 'Guided walk + traditional lunch',
            costPrice: 2200,
            sellingPrice: 5200,
          },
          { id: 'it4-i5', type: 'MEAL', title: 'Beach shack dinner credit', details: '₹2000 resort credit', costPrice: 1500, sellingPrice: 2800 },
        ],
      },
    ],
  },
  {
    id: 'itin-5',
    agencyId: 'agency-1',
    title: 'Template: Golden Triangle Express',
    description: 'Reusable 4D/3N Delhi–Agra–Jaipur skeleton for quick quotes. Duplicate and attach flights.',
    startDate: undefined,
    endDate: undefined,
    status: 'DRAFT',
    totalPrice: 98500.0,
    markupMargin: 15.0,
    taxRate: 10.0,
    isTemplate: true,
    proposalTheme: 'luxury',
    days: [
      {
        id: 'it5-day-1',
        dayNumber: 1,
        title: 'Delhi arrival',
        description: 'Old Delhi food walk optional add-on.',
        items: [
          { id: 'it5-i1', type: 'HOTEL', title: 'CP / Aerocity 4★', details: '1 night BB', costPrice: 5500, sellingPrice: 8200 },
          { id: 'it5-i2', type: 'TRANSFER', title: 'Airport meet', details: 'Sedan', costPrice: 800, sellingPrice: 1800 },
        ],
      },
      {
        id: 'it5-day-2',
        dayNumber: 2,
        title: 'Agra sunrise',
        description: 'Taj timing + Agra Fort.',
        items: [
          {
            id: 'it5-i3',
            type: 'TRANSFER',
            title: 'Delhi → Agra expressway',
            details: 'Private car',
            costPrice: 3500,
            sellingPrice: 6200,
          },
          {
            id: 'it5-i4',
            type: 'ACTIVITY',
            title: 'Taj Mahal + guide',
            details: 'Skip-the-line assist where available',
            costPrice: 4200,
            sellingPrice: 7800,
          },
          { id: 'it5-i5', type: 'HOTEL', title: 'Agra stay — Taj view category', details: '1 night', costPrice: 6200, sellingPrice: 10500 },
        ],
      },
      {
        id: 'it5-day-3',
        dayNumber: 3,
        title: 'Pink City',
        description: 'Amber Fort + city palace window.',
        items: [
          {
            id: 'it5-i6',
            type: 'TRANSFER',
            title: 'Agra → Jaipur',
            details: 'Private car, Fatehpur Sikri photo stop',
            costPrice: 4800,
            sellingPrice: 7600,
          },
          { id: 'it5-i7', type: 'HOTEL', title: 'Jaipur haveli / boutique', details: '1 night', costPrice: 5800, sellingPrice: 9800 },
        ],
      },
    ],
  },
];

const defaultBookings: Booking[] = [
  {
    id: 'book-1',
    agencyId: 'agency-1',
    customerId: 'cust-1',
    itineraryId: 'itin-1',
    status: 'PROCESSING',
    hotelConfirmationCode: 'DVR-876543-IN',
    driverName: 'Imtiyaz Wani',
    driverPhone: '+91 99065 11223',
    visaStatus: 'DOCUMENTS_SUBMITTED',
    createdAt: '2026-05-18T16:30:00Z',
  },
  {
    id: 'book-2',
    agencyId: 'agency-1',
    customerId: 'cust-3',
    itineraryId: 'itin-3',
    status: 'CONFIRMED',
    hotelConfirmationCode: 'AHC-44521-KL',
    driverName: 'Renjith Kumar',
    driverPhone: '+91 98471 88901',
    createdAt: '2026-05-19T09:45:00Z',
  },
  {
    id: 'book-3',
    agencyId: 'agency-1',
    customerId: 'cust-5',
    itineraryId: 'itin-4',
    status: 'PROCESSING',
    hotelConfirmationCode: 'SGB-99211-GOA',
    createdAt: '2026-05-18T11:20:00Z',
  },
  {
    id: 'book-4',
    agencyId: 'agency-1',
    customerId: 'cust-4',
    itineraryId: 'itin-2',
    status: 'PENDING',
    createdAt: '2026-05-21T17:05:00Z',
  },
];

const defaultInvoices: Invoice[] = [
  {
    id: 'inv-1',
    agencyId: 'agency-1',
    bookingId: 'book-1',
    invoiceNumber: 'INV-2026-001',
    amount: 285000.0,
    dueDate: '2026-06-15',
    status: 'PARTIALLY_PAID',
  },
  {
    id: 'inv-2',
    agencyId: 'agency-1',
    bookingId: 'book-2',
    invoiceNumber: 'INV-2026-002',
    amount: 164000.0,
    dueDate: '2026-06-05',
    status: 'PARTIALLY_PAID',
  },
  {
    id: 'inv-3',
    agencyId: 'agency-1',
    bookingId: 'book-3',
    invoiceNumber: 'INV-2026-003',
    amount: 112000.0,
    dueDate: '2026-07-10',
    status: 'UNPAID',
  },
  {
    id: 'inv-4',
    agencyId: 'agency-1',
    bookingId: 'book-4',
    invoiceNumber: 'INV-2026-004',
    amount: 131560.0,
    dueDate: '2026-08-20',
    status: 'UNPAID',
  },
];

const defaultPayments: Payment[] = [
  {
    id: 'pay-1',
    agencyId: 'agency-1',
    invoiceId: 'inv-1',
    amount: 120000.0,
    paymentMethod: 'UPI',
    transactionReference: 'UPI-982173918',
    paymentDate: '2026-05-19T10:00:00Z',
  },
  {
    id: 'pay-2',
    agencyId: 'agency-1',
    invoiceId: 'inv-2',
    amount: 82000.0,
    paymentMethod: 'NEFT',
    transactionReference: 'NEFT-KL-778821',
    paymentDate: '2026-05-20T15:40:00Z',
  },
];

const defaultExpenses: Expense[] = [
  { id: 'exp-1', agencyId: 'agency-1', amount: 15000.0, category: 'MARKETING', description: 'Instagram ads for Kashmir honeymoon campaigns', expenseDate: '2026-05-05T09:00:00Z' },
  { id: 'exp-2', agencyId: 'agency-1', amount: 8000.0, category: 'UTILITIES', description: 'Travel CRM software subscription', expenseDate: '2026-05-12T00:00:00Z' },
  { id: 'exp-3', agencyId: 'agency-1', amount: 12500.0, category: 'OPERATIONS', description: 'Spiti scouting trip — permits & local liaison', expenseDate: '2026-05-16T06:30:00Z' },
  { id: 'exp-4', agencyId: 'agency-1', amount: 4200.0, category: 'MARKETING', description: 'Kerala reel shoot — creator fee', expenseDate: '2026-05-14T11:15:00Z' },
];

const defaultVendorPayouts: VendorPayout[] = [
  { id: 'pout-1', agencyId: 'agency-1', vendorId: 'vend-1', amount: 50000.0, paymentDate: '2026-05-20T14:00:00Z' },
  { id: 'pout-2', agencyId: 'agency-1', vendorId: 'vend-4', amount: 28000.0, paymentDate: '2026-05-21T10:00:00Z' },
  { id: 'pout-3', agencyId: 'agency-1', vendorId: 'vend-2', amount: 36000.0, paymentDate: '2026-05-22T09:30:00Z' },
];

const defaultAuditLogs: AuditLog[] = [
  { id: 'log-1', agencyId: 'agency-1', userName: 'Dhruv Shah', action: 'CREATE', entityType: 'Lead', details: 'Added new Lead: Kashmir Honeymoon Escape', createdAt: '2026-05-10T14:32:00Z' },
  { id: 'log-2', agencyId: 'agency-1', userName: 'Neha Kapoor', action: 'UPDATE', entityType: 'Itinerary', details: 'Modified pricing markup margins on Gulmarg tour day', createdAt: '2026-05-22T11:00:00Z' },
  { id: 'log-3', agencyId: 'agency-1', userName: 'Neha Kapoor', action: 'CREATE', entityType: 'Itinerary', details: 'Created Kerala Alleppey Slow Lane proposal', createdAt: '2026-05-15T16:05:00Z' },
  { id: 'log-4', agencyId: 'agency-1', userName: 'Neha Kapoor', action: 'UPDATE', entityType: 'Booking', details: 'Status → CONFIRMED for book-2 (Kerala)', createdAt: '2026-05-19T10:05:00Z' },
  { id: 'log-5', agencyId: 'agency-1', userName: 'Dhruv Shah', action: 'CREATE', entityType: 'Invoice', details: 'Raised INV-2026-003 for Goa booking', createdAt: '2026-05-18T11:25:00Z' },
];

const defaultRoleDefinitions: RoleDefinition[] = defaultAgencies.flatMap((a) =>
  createDefaultRoleDefinitionsForAgency(a.id),
);

function persistRoleDefinitions(roleDefinitions: RoleDefinition[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RBAC_DEFINITIONS_STORAGE_KEY, JSON.stringify(roleDefinitions));
  } catch {
    /* quota / blocked */
  }
}

function ensureRoleDefinitionsForAgencies(
  agencyIds: string[],
  existing: RoleDefinition[],
): RoleDefinition[] {
  const missing = agencyIds.filter(
    (id) => !existing.some((r) => r.agencyId === id),
  );
  if (missing.length === 0) return existing;
  const roleDefinitions = [
    ...existing,
    ...missing.flatMap((id) => createDefaultRoleDefinitionsForAgency(id)),
  ];
  persistRoleDefinitions(roleDefinitions);
  return roleDefinitions;
}

function normalizeCrud(raw: unknown): RbacCrudSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const bit = (k: keyof RbacCrudSet) =>
    typeof o[k] === 'boolean' ? (o[k] as boolean) : false;
  return { view: bit('view'), create: bit('create'), edit: bit('edit'), delete: bit('delete') };
}

function normalizeRoleDefinition(raw: unknown): RoleDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const agencyId = typeof r.agencyId === 'string' ? r.agencyId : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const isSystem = r.isSystem === true;
  if (!id || !agencyId || !name) return null;

  const permissions = {} as Record<RbacModuleKey, RbacCrudSet>;
  const permsSrc = r.permissions;
  if (!permsSrc || typeof permsSrc !== 'object') return null;
  const permObj = permsSrc as Record<string, unknown>;
  for (const { key } of RBAC_MODULE_DEFS) {
    const cell = normalizeCrud(permObj[key]);
    if (!cell) return null;
    permissions[key] = cell;
  }
  return { id, agencyId, name, isSystem, permissions };
}

function mergeRoleDefinitionsSeedWithStorage(
  seed: RoleDefinition[],
  storedRows: unknown[],
): RoleDefinition[] {
  const byId = new Map(seed.map((row) => [row.id, row]));
  for (const row of storedRows) {
    const n = normalizeRoleDefinition(row);
    if (n) byId.set(n.id, n);
  }
  return [...byId.values()];
}

export const useStore = create<CRMStore>((set, get) => ({
  agencies: defaultAgencies,
  currentAgency: defaultAgencies[0],
  currentUser: null,
  authStatus: 'idle',
  users: defaultUsers,

  roleDefinitions: defaultRoleDefinitions,

  leads: defaultLeads,
  leadNotes: defaultLeadNotes,
  leadActivities: defaultLeadActivities,
  leadFollowups: defaultLeadFollowups,
  customers: defaultCustomers,
  itineraries: defaultItineraries,
  vendors: defaultVendors,
  bookings: defaultBookings,
  invoices: defaultInvoices,
  payments: defaultPayments,
  expenses: defaultExpenses,
  vendorPayouts: defaultVendorPayouts,
  auditLogs: defaultAuditLogs,
  
  theme: 'light',
  workspacePreferences: { ...DEFAULT_WORKSPACE_PREFERENCES },

  setTheme: (theme) => set({ theme }),

  setWorkspacePreferences: (partial) => {
    set((state) => {
      const workspacePreferences = { ...state.workspacePreferences, ...partial };
      /** Clamp due days when partial update supplies out-of-range */
      workspacePreferences.defaultInvoiceDueDays = Math.min(
        365,
        Math.max(1, Math.round(Number(workspacePreferences.defaultInvoiceDueDays) || 30)),
      );
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(WORKSPACE_PREFS_STORAGE_KEY, JSON.stringify(workspacePreferences));
        }
      } catch {
        /* quota / blocked */
      }
      return { workspacePreferences };
    });
  },

  resetWorkspacePreferences: () => {
    const workspacePreferences = { ...DEFAULT_WORKSPACE_PREFERENCES };
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(WORKSPACE_PREFS_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    set({ workspacePreferences });
  },

  setCurrentAgency: (agencyId) => {
    const agency = get().agencies.find(a => a.id === agencyId);
    if (agency) {
      set({ currentAgency: agency });
      // update current user if their agency doesn't match
      const matchingUser = get().users.find(u => u.agencyId === agencyId);
      if (matchingUser) {
        set({ currentUser: matchingUser });
      }
    }
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  setSessionFromApi: (user, agency) => {
    writeSessionCache(user, agency);
    set((state) => {
      const agencies = state.agencies.some((a) => a.id === agency.id)
        ? state.agencies.map((a) => (a.id === agency.id ? agency : a))
        : [...state.agencies, agency];
      const users = state.users.some((u) => u.id === user.id)
        ? state.users.map((u) => (u.id === user.id ? user : u))
        : [...state.users, user];
      const roleDefinitions = ensureRoleDefinitionsForAgencies(
        [agency.id],
        state.roleDefinitions,
      );
      return {
        agencies,
        users,
        currentAgency: agency,
        currentUser: user,
        authStatus: 'authenticated' as const,
        roleDefinitions,
      };
    });
  },

  hydrateSession: async () => {
    const cached = readSessionCache();
    const hasUser = Boolean(get().currentUser);

    if (cached && !hasUser) {
      get().setSessionFromApi(cached.user, cached.agency);
    } else if (!hasUser && get().authStatus !== 'authenticated') {
      set({ authStatus: 'loading' });
    }

    try {
      const response = await fetch('/api/crm/auth/session', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        if (!get().currentUser) {
          clearSessionCache();
          set({ currentUser: null, authStatus: 'unauthenticated' });
        }
        return;
      }
      const session = await response.json();
      get().setSessionFromApi(mapApiUser(session.user), mapApiAgency(session.agency));
    } catch {
      if (!get().currentUser) {
        set({ currentUser: null, authStatus: 'unauthenticated' });
      }
    }
  },

  clearAuthSession: () => {
    clearSessionCache();
    set({ currentUser: null, authStatus: 'idle' });
  },

  registerAgency: (agencyName, subdomain, adminName, email) => {
    const newAgency: Agency = {
      id: `agency-${Date.now()}`,
      name: agencyName,
      subdomain: subdomain.toLowerCase().replace(/\s+/g, '-'),
      primaryColor: '#3b82f6',
      secondaryColor: '#1e293b',
      subscriptionPlan: 'FREE',
    };

    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name: adminName,
      agencyId: newAgency.id,
      role: 'Agency Admin',
    };

    set((state) => {
      const newRoles = createDefaultRoleDefinitionsForAgency(newAgency.id);
      const roleDefinitions = [...state.roleDefinitions, ...newRoles];
      persistRoleDefinitions(roleDefinitions);
      return {
        agencies: [...state.agencies, newAgency],
        users: [...state.users, newUser],
        currentAgency: newAgency,
        currentUser: newUser,
        roleDefinitions,
      };
    });

    get().logAction('CREATE', 'Agency', `Registered new tenant: ${agencyName} (${subdomain})`);
    return newAgency;
  },

  addRoleDefinition: (roleName, cloneFromRoleId) => {
    const agencyId = get().currentAgency.id;
    const trimmed = roleName.trim();
    if (!trimmed) return null;

    const stateBefore = get();
    if (
      stateBefore.roleDefinitions.some(
        (r) =>
          r.agencyId === agencyId && r.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      return null;
    }

    let permissions = permissionsAllDenied();
    if (cloneFromRoleId) {
      const src = stateBefore.roleDefinitions.find(
        (r) => r.id === cloneFromRoleId && r.agencyId === agencyId,
      );
      if (src) permissions = duplicateRolePermissions(src);
    }

    const def: RoleDefinition = {
      id: uniqueEntityId('role'),
      agencyId,
      name: trimmed,
      isSystem: false,
      permissions,
    };

    set((s) => {
      const roleDefinitions = [...s.roleDefinitions, def];
      persistRoleDefinitions(roleDefinitions);
      return { roleDefinitions };
    });

    get().logAction('CREATE', 'Role', `Defined workspace role "${trimmed}" (${agencyId})`);
    return def;
  },

  renameRoleDefinition: (roleId, nextName) => {
    const agencyId = get().currentAgency.id;
    const trimmed = nextName.trim();
    if (!trimmed) return false;

    const stateBefore = get();
    const role = stateBefore.roleDefinitions.find(
      (r) => r.id === roleId && r.agencyId === agencyId,
    );
    if (!role || role.isSystem) return false;

    if (
      stateBefore.roleDefinitions.some(
        (r) =>
          r.agencyId === agencyId &&
          r.id !== roleId &&
          r.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      return false;
    }

    const previousName = role.name;

    set((s) => {
      const roleDefinitions = s.roleDefinitions.map((r) =>
        r.id === roleId && r.agencyId === agencyId ? { ...r, name: trimmed } : r,
      );
      const users = s.users.map((u) =>
        u.agencyId === agencyId && u.role === previousName ? { ...u, role: trimmed } : u,
      );
      persistRoleDefinitions(roleDefinitions);

      let currentUserOut = s.currentUser;
      if (
        currentUserOut &&
        currentUserOut.agencyId === agencyId &&
        currentUserOut.role === previousName
      ) {
        currentUserOut = { ...currentUserOut, role: trimmed };
      }

      return { roleDefinitions, users, currentUser: currentUserOut };
    });

    get().logAction(
      'UPDATE',
      'Role',
      `Renamed role "${previousName}" → "${trimmed}" (${agencyId})`,
    );
    return true;
  },

  deleteRoleDefinition: (roleId) => {
    const agencyId = get().currentAgency.id;
    const stateBefore = get();
    const role = stateBefore.roleDefinitions.find(
      (r) => r.id === roleId && r.agencyId === agencyId,
    );
    if (!role || role.isSystem) return false;

    if (
      stateBefore.users.some((u) => u.agencyId === agencyId && u.role === role.name)
    ) {
      return false;
    }

    set((s) => {
      const roleDefinitions = s.roleDefinitions.filter(
        (r) => !(r.id === roleId && r.agencyId === agencyId),
      );
      persistRoleDefinitions(roleDefinitions);
      return { roleDefinitions };
    });

    get().logAction(
      'DELETE',
      'Role',
      `Removed workspace role "${role.name}" (${agencyId})`,
    );
    return true;
  },

  setRoleModulePermission: (roleId, module, permission, value) => {
    const agencyId = get().currentAgency.id;

    const modOk = RBAC_MODULE_DEFS.some((d) => d.key === module);
    const permOk =
      permission === 'view' ||
      permission === 'create' ||
      permission === 'edit' ||
      permission === 'delete';
    if (!modOk || !permOk) return;

    const existing = get().roleDefinitions.find(
      (r) => r.id === roleId && r.agencyId === agencyId,
    );
    if (!existing) return;

    set((s) => {
      const ix = s.roleDefinitions.findIndex(
        (r) => r.id === roleId && r.agencyId === agencyId,
      );
      if (ix === -1) return s;

      const role = s.roleDefinitions[ix];
      const row = role.permissions[module];
      const nextRow: RbacCrudSet = row
        ? { ...row, [permission]: value }
        : {
            view: permission === 'view' ? value : false,
            create: permission === 'create' ? value : false,
            edit: permission === 'edit' ? value : false,
            delete: permission === 'delete' ? value : false,
          };

      const nextDef: RoleDefinition = {
        ...role,
        permissions: { ...role.permissions, [module]: nextRow },
      };

      const roleDefinitions = [...s.roleDefinitions];
      roleDefinitions[ix] = nextDef;
      persistRoleDefinitions(roleDefinitions);
      return { roleDefinitions };
    });
  },

  // Lead CRM Operations
  addLead: (leadData) => {
    const agencyId = get().currentAgency.id;
    const newLeadId = uniqueEntityId('lead');

    let customerId = (leadData.customerId || '').trim() || undefined;

    /** Every new lead maps to Directory — reuse existing card by email or create one */
    if (!customerId) {
      const emailTrim = (leadData.email || '').trim();
      const normalized = emailTrim.toLowerCase();

      const byEmail =
        normalized &&
        get().customers.find(
          (c) =>
            c.agencyId === agencyId && c.email.toLowerCase() === normalized,
        );

      if (byEmail) {
        customerId = byEmail.id;
      } else {
        const profileEmail =
          emailTrim ||
          `noreply.profile.${newLeadId.replace(/^lead-/, '')}@crm.directory`;
        const cust = get().addCustomer({
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          email: profileEmail,
          phone: leadData.phone,
        });
        customerId = cust.id;
      }
    }

    const newLead: Lead = {
      ...leadData,
      customerId,
      id: newLeadId,
      agencyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      leads: [newLead, ...state.leads],
      leadActivities: [
        {
          id: `act-${Date.now()}`,
          leadId: newLead.id,
          type: 'NOTE',
          description: `Lead created from source: ${leadData.source || 'Manual Input'}${customerId ? ' · Customer Directory profile linked' : ''}`,
          createdBy: get().currentUser?.name || 'System',
          createdAt: new Date().toISOString(),
        },
        ...state.leadActivities,
      ],
    }));

    get().logAction(
      'CREATE',
      'Lead',
      `Created lead ${newLead.title} for ${newLead.firstName} ${newLead.lastName}`,
    );
  },

  updateLeadStatus: (leadId, status) => {
    const oldLead = get().leads.find(l => l.id === leadId);
    if (!oldLead) return;

    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, status, updatedAt: new Date().toISOString() } : l
      ),
      leadActivities: [
        {
          id: `act-${Date.now()}`,
          leadId,
          type: 'STAGE_CHANGE',
          description: `Moved stage from ${oldLead.status} to ${status}`,
          createdBy: get().currentUser?.name || 'System',
          createdAt: new Date().toISOString(),
        },
        ...state.leadActivities,
      ],
    }));

    get().logAction('UPDATE', 'Lead', `Updated lead status of ${oldLead.title} to ${status}`);
  },

  updateLead: (leadId, updates) => {
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
      ),
    }));
    get().logAction('UPDATE', 'Lead', `Updated lead fields for lead ID: ${leadId}`);
  },

  deleteLead: (leadId) => {
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== leadId),
    }));
    get().logAction('DELETE', 'Lead', `Deleted lead ID: ${leadId}`);
  },

  addLeadNote: (leadId, content) => {
    const newNote: LeadNote = {
      id: `note-${Date.now()}`,
      leadId,
      content,
      createdBy: get().currentUser?.name || 'System',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      leadNotes: [newNote, ...state.leadNotes],
      leadActivities: [
        {
          id: `act-note-${Date.now()}`,
          leadId,
          type: 'NOTE',
          description: `Added note: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
          createdBy: get().currentUser?.name || 'System',
          createdAt: new Date().toISOString(),
        },
        ...state.leadActivities,
      ],
    }));
  },

  addLeadFollowup: (leadId, scheduledAt, notes) => {
    const newFollowup: LeadFollowup = {
      id: `fup-${Date.now()}`,
      leadId,
      scheduledAt,
      status: 'PENDING',
      notes,
      createdBy: get().currentUser?.name || 'System',
    };

    set((state) => ({
      leadFollowups: [newFollowup, ...state.leadFollowups],
    }));
    get().logAction('CREATE', 'Followup', `Scheduled follow-up reminder for lead ID: ${leadId}`);
  },

  // Customer Operations
  addCustomer: (custData) => {
    const newCustomer: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      agencyId: get().currentAgency.id,
      travelHistory: [],
      documents: [],
    };

    set((state) => ({
      customers: [newCustomer, ...state.customers],
    }));
    get().logAction('CREATE', 'Customer', `Added customer: ${custData.firstName} ${custData.lastName}`);
    return newCustomer;
  },

  updateCustomer: (customerId, updates) => {
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === customerId ? { ...c, ...updates } : c
      ),
    }));
    get().logAction('UPDATE', 'Customer', `Updated customer metadata for ID: ${customerId}`);
  },

  uploadCustomerDoc: (customerId, doc) => {
    const newDoc = {
      name: doc.name,
      url: '#',
      category: doc.category,
      size: doc.size,
    };

    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === customerId ? { ...c, documents: [...c.documents, newDoc] } : c
      ),
    }));
    get().logAction('UPDATE', 'Customer', `Uploaded ${doc.category} document for Customer ID: ${customerId}`);
  },

  // Itinerary Planner Actions
  addItinerary: (itinData) => {
    const newItinerary: Itinerary = {
      ...itinData,
      id: uniqueEntityId('itin'),
      agencyId: get().currentAgency.id,
      days: itinData.days || [],
      proposalTheme: itinData.proposalTheme || 'luxury',
    };

    set((state) => ({
      itineraries: [newItinerary, ...state.itineraries],
    }));
    get().logAction('CREATE', 'Itinerary', `Created itinerary plan: ${itinData.title}`);
    return newItinerary;
  },

  updateItinerary: (itineraryId, updates) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          const updated = { ...it, ...updates };
          
          // Re-calculate aggregate total price when day-items change, markup changes, or tax changes
          let baseCost = 0;
          updated.days.forEach((day) => {
            day.items.forEach((item) => {
              baseCost += Number(item.sellingPrice || 0);
            });
          });
          
          const markupMult = 1 + Number(updated.markupMargin || 0) / 100;
          const taxMult = 1 + Number(updated.taxRate || 0) / 100;
          updated.totalPrice = Number((baseCost * markupMult * taxMult).toFixed(2));
          
          return updated;
        }
        return it;
      }),
    }));
  },

  deleteItinerary: (itineraryId) => {
    const state = get();
    const itinerary = state.itineraries.find((it) => it.id === itineraryId);
    if (!itinerary) return;

    const agencyId = itinerary.agencyId;
    const doomedBookingIds = new Set(
      state.bookings.filter((b) => b.agencyId === agencyId && b.itineraryId === itineraryId).map((b) => b.id),
    );
    const doomedInvoiceIds = new Set(
      state.invoices.filter((inv) => doomedBookingIds.has(inv.bookingId)).map((inv) => inv.id),
    );

    const now = new Date().toISOString();
    set((s) => ({
      itineraries: s.itineraries.filter((it) => it.id !== itineraryId),
      leads: s.leads.map((l) =>
        l.proposalItineraryId === itineraryId ? { ...l, proposalItineraryId: undefined, updatedAt: now } : l,
      ),
      bookings: s.bookings.filter((b) => !doomedBookingIds.has(b.id)),
      invoices: s.invoices.filter((inv) => !doomedInvoiceIds.has(inv.id)),
      payments: s.payments.filter((p) => !doomedInvoiceIds.has(p.invoiceId)),
    }));

    get().logAction('DELETE', 'Itinerary', `Deleted itinerary: ${itinerary.title}`);
  },

  addItineraryDay: (itineraryId, title, description) => {
    let newDayId = '';
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id !== itineraryId) return it;
        const existingDays = it.days ?? [];
        const nextDayNum = existingDays.length + 1;
        const newDay: ItineraryDay = {
          id: uniqueEntityId('day'),
          dayNumber: nextDayNum,
          title,
          description,
          items: [],
        };
        newDayId = newDay.id;
        return { ...it, days: [...existingDays, newDay] };
      }),
    }));
    if (newDayId) {
      get().updateItinerary(itineraryId, {});
      get().logAction('UPDATE', 'Itinerary', `Added day "${title}" to itinerary ID: ${itineraryId}`);
    }
    return newDayId;
  },

  updateItineraryDay: (itineraryId, dayId, updates) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          return {
            ...it,
            days: (it.days ?? []).map((d) => (d.id === dayId ? { ...d, ...updates } : d)),
          };
        }
        return it;
      }),
    }));
  },

  deleteItineraryDay: (itineraryId, dayId) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          const filteredDays = it.days.filter((d) => d.id !== dayId);
          // Recalculate day numbers sequentially
          const reorderedDays = filteredDays.map((d, index) => ({
            ...d,
            dayNumber: index + 1,
          }));
          
          const updated = { ...it, days: reorderedDays };
          // Trigger pricing recalculation
          let baseCost = 0;
          updated.days.forEach((d) => d.items.forEach((item) => { baseCost += Number(item.sellingPrice); }));
          const markupMult = 1 + Number(updated.markupMargin) / 100;
          const taxMult = 1 + Number(updated.taxRate) / 100;
          updated.totalPrice = Number((baseCost * markupMult * taxMult).toFixed(2));
          
          return updated;
        }
        return it;
      }),
    }));
  },

  addItineraryItem: (itineraryId, dayId, itemData) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          const updatedDays = it.days.map((d) => {
            if (d.id === dayId) {
              const newItem: ItineraryItem = {
                ...itemData,
                id: uniqueEntityId('item'),
              };
              return { ...d, items: [...d.items, newItem] };
            }
            return d;
          });
          
          const updated = { ...it, days: updatedDays };
          // Price auto calculations
          let baseCost = 0;
          updated.days.forEach((d) => d.items.forEach((item) => { baseCost += Number(item.sellingPrice); }));
          const markupMult = 1 + Number(updated.markupMargin) / 100;
          const taxMult = 1 + Number(updated.taxRate) / 100;
          updated.totalPrice = Number((baseCost * markupMult * taxMult).toFixed(2));
          
          return updated;
        }
        return it;
      }),
    }));
  },

  updateItineraryItem: (itineraryId, dayId, itemId, updates) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          const updatedDays = it.days.map((d) => {
            if (d.id === dayId) {
              return {
                ...d,
                items: d.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
              };
            }
            return d;
          });
          
          const updated = { ...it, days: updatedDays };
          // Price recalculation
          let baseCost = 0;
          updated.days.forEach((d) => d.items.forEach((item) => { baseCost += Number(item.sellingPrice); }));
          const markupMult = 1 + Number(updated.markupMargin) / 100;
          const taxMult = 1 + Number(updated.taxRate) / 100;
          updated.totalPrice = Number((baseCost * markupMult * taxMult).toFixed(2));
          
          return updated;
        }
        return it;
      }),
    }));
  },

  deleteItineraryItem: (itineraryId, dayId, itemId) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          const updatedDays = it.days.map((d) => {
            if (d.id === dayId) {
              return {
                ...d,
                items: d.items.filter((i) => i.id !== itemId),
              };
            }
            return d;
          });
          
          const updated = { ...it, days: updatedDays };
          // Price recalculation
          let baseCost = 0;
          updated.days.forEach((d) => d.items.forEach((item) => { baseCost += Number(item.sellingPrice); }));
          const markupMult = 1 + Number(updated.markupMargin) / 100;
          const taxMult = 1 + Number(updated.taxRate) / 100;
          updated.totalPrice = Number((baseCost * markupMult * taxMult).toFixed(2));
          
          return updated;
        }
        return it;
      }),
    }));
  },

  reorderItineraryDays: (itineraryId, days) => {
    set((state) => ({
      itineraries: state.itineraries.map((it) => {
        if (it.id === itineraryId) {
          // Re-index day numbers sequentially
          const reindexed = days.map((d, index) => ({
            ...d,
            dayNumber: index + 1,
          }));
          return { ...it, days: reindexed };
        }
        return it;
      }),
    }));
    get().logAction('UPDATE', 'Itinerary', `Reordered days in Itinerary ID: ${itineraryId}`);
  },

  // Booking Operations
  createBooking: (customerId, itineraryId, guestFromLead) => {
    const agencyId = get().currentAgency.id;
    const dup = get().bookings.find(
      (b) => b.agencyId === agencyId && b.customerId === customerId && b.itineraryId === itineraryId,
    );
    if (dup) return dup;

    let itinerary = get().itineraries.find((i) => i.id === itineraryId && i.agencyId === agencyId);
    /** Recompute itinerary retail total from line items before drafting the invoice */
    if (itinerary) {
      get().updateItinerary(itineraryId, {});
      itinerary = get().itineraries.find((i) => i.id === itineraryId && i.agencyId === agencyId);
    }

    const cidTrim = (customerId || '').trim();
    const guestFirstName =
      !cidTrim && guestFromLead?.firstName?.trim() ? guestFromLead.firstName.trim() : undefined;
    const guestLastName =
      !cidTrim && guestFromLead?.lastName?.trim() ? guestFromLead.lastName.trim() : undefined;

    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      agencyId,
      customerId,
      itineraryId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      visaStatus: 'PENDING',
      ...(guestFirstName || guestLastName ? { guestFirstName, guestLastName } : {}),
    };

    set((state) => ({
      bookings: [newBooking, ...state.bookings],
      itineraries:
        itinerary && !itinerary.customerId && customerId.trim()
          ? state.itineraries.map((it) =>
              it.id === itineraryId ? { ...it, customerId } : it,
            )
          : state.itineraries,
    }));

    if (itinerary) {
      const invoiceAmount = Number(itinerary.totalPrice) || 0;
      const dueDays = Math.min(
        365,
        Math.max(1, Math.round(Number(get().workspacePreferences.defaultInvoiceDueDays) || 30)),
      );
      const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      get().createInvoice(newBooking.id, invoiceAmount, dueDate);
    }

    get().logAction('CREATE', 'Booking', `Created booking from itinerary ID: ${itineraryId}`);
    return newBooking;
  },

  updateBooking: (bookingId, updates) => {
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === bookingId ? { ...b, ...updates } : b
      ),
    }));
    get().logAction('UPDATE', 'Booking', `Updated booking status and operations data for ID: ${bookingId}`);
  },

  // Finance operations
  createInvoice: (bookingId, amount, dueDate) => {
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      agencyId: get().currentAgency.id,
      bookingId,
      invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      amount,
      dueDate,
      status: 'UNPAID',
    };
    set((state) => ({
      invoices: [newInvoice, ...state.invoices],
    }));
    get().logAction('CREATE', 'Invoice', `Generated Invoice ${newInvoice.invoiceNumber} for Booking ID: ${bookingId}`);
  },

  recordPayment: (invoiceId, amount, method, ref) => {
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      agencyId: get().currentAgency.id,
      invoiceId,
      amount,
      paymentMethod: method,
      transactionReference: ref,
      paymentDate: new Date().toISOString(),
    };

    set((state) => {
      // Adjust invoice status based on amount paid
      const updatedInvoices = state.invoices.map((inv) => {
        if (inv.id === invoiceId) {
          const totalPaid = Number(amount) + state.payments
            .filter((p) => p.invoiceId === invoiceId)
            .reduce((sum, p) => sum + Number(p.amount), 0);
          
          let status: Invoice['status'] = 'PARTIALLY_PAID';
          if (totalPaid >= inv.amount) {
            status = 'PAID';
          }
          return { ...inv, status };
        }
        return inv;
      });

      return {
        payments: [newPayment, ...state.payments],
        invoices: updatedInvoices,
      };
    });

    get().logAction('CREATE', 'Payment', `Recorded payment of ₹${amount} for Invoice ID: ${invoiceId}`);
  },

  recordExpense: (amount, category, description) => {
    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      agencyId: get().currentAgency.id,
      amount,
      category,
      description,
      expenseDate: new Date().toISOString(),
    };
    set((state) => ({
      expenses: [newExpense, ...state.expenses],
    }));
    get().logAction('CREATE', 'Expense', `Logged expense: ₹${amount} under category: ${category}`);
  },

  recordVendorPayout: (vendorId, amount) => {
    const newPayout: VendorPayout = {
      id: `pout-${Date.now()}`,
      agencyId: get().currentAgency.id,
      vendorId,
      amount,
      paymentDate: new Date().toISOString(),
    };

    set((state) => {
      // Deduct vendor ledger balances
      const updatedVendors = state.vendors.map((v) =>
        v.id === vendorId ? { ...v, ledgerBalance: Math.max(0, Number(v.ledgerBalance) - Number(amount)) } : v
      );
      return {
        vendorPayouts: [newPayout, ...state.vendorPayouts],
        vendors: updatedVendors,
      };
    });

    get().logAction('CREATE', 'VendorPayout', `Disbursed ₹${amount} payout to Vendor ID: ${vendorId}`);
  },

  addVendor: (vendorData) => {
    const newVendor: Vendor = {
      ...vendorData,
      id: `vend-${Date.now()}`,
      agencyId: get().currentAgency.id,
      ledgerBalance: 0.00,
    };
    set((state) => ({
      vendors: [...state.vendors, newVendor],
    }));
    get().logAction('CREATE', 'Vendor', `Registered new partner vendor: ${vendorData.name}`);
  },

  updateVendor: (vendorId, updates) => {
    set((state) => ({
      vendors: state.vendors.map((v) => (v.id === vendorId ? { ...v, ...updates } : v)),
    }));
  },

  logAction: (action, entityType, details) => {
    const newLog: AuditLog = {
      id: uniqueEntityId('log'),
      agencyId: get().currentAgency.id,
      userName: get().currentUser?.name || 'System',
      action,
      entityType,
      details,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      auditLogs: [newLog, ...state.auditLogs],
    }));
  },
}));

function parseStoredWorkspacePrefs(raw: string): Partial<WorkspacePreferences> {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<WorkspacePreferences> = {};
    if (typeof o.defaultInvoiceDueDays === 'number' && Number.isFinite(o.defaultInvoiceDueDays)) {
      out.defaultInvoiceDueDays = Math.min(365, Math.max(1, Math.round(o.defaultInvoiceDueDays)));
    }
    if (typeof o.sidebarCompact === 'boolean') out.sidebarCompact = o.sidebarCompact;
    if (typeof o.densePagePadding === 'boolean') out.densePagePadding = o.densePagePadding;
    return out;
  } catch {
    return {};
  }
}

/** Restore workspace preferences from localStorage (safe to call on dashboard mount only). */
export function hydrateWorkspacePreferences() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFS_STORAGE_KEY);
    if (!raw) return;
    const partial = parseStoredWorkspacePrefs(raw);
    if (Object.keys(partial).length === 0) return;
    useStore.setState((s) => ({
      workspacePreferences: { ...s.workspacePreferences, ...partial },
    }));
  } catch {
    /* ignore */
  }
}

/** Restore role permission definitions (merge with seed defaults for each active agency). */
export function hydrateRoleDefinitions() {
  if (typeof window === 'undefined') return;
  const { agencies, currentAgency } = useStore.getState();
  const agencyIds = [...new Set([...agencies.map((a) => a.id), currentAgency.id])];
  const seed = agencyIds.flatMap((id) => createDefaultRoleDefinitionsForAgency(id));
  try {
    const raw = localStorage.getItem(RBAC_DEFINITIONS_STORAGE_KEY);
    if (!raw) {
      useStore.setState({ roleDefinitions: seed });
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      useStore.setState({ roleDefinitions: seed });
      return;
    }
    const merged = mergeRoleDefinitionsSeedWithStorage(seed, parsed);
    useStore.setState({ roleDefinitions: merged });
  } catch {
    useStore.setState({ roleDefinitions: seed });
  }
}
