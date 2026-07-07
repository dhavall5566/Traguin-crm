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
import type { LeadDetailsFields } from '@/lib/lead-details';

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

export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type LeadCategory = 'DOMESTIC' | 'INTERNATIONAL' | 'CORPORATE' | 'VISA_ONLY';

export interface Lead extends LeadDetailsFields {
  id: string;
  /** Human-readable reference, e.g. TRG001-ITN */
  leadCode?: string;
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
  assignmentStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  assignedById?: string;
  priority?: LeadPriority;
  leadCategory?: LeadCategory;
  customerId?: string;
  /** Preferred proposal / itinerary for this lead (conversion card). */
  proposalItineraryId?: string;
  createdAt: string;
  updatedAt: string;
  /** Set by backend when status enters PROPOSAL_SENT (canonical stuck-proposal anchor). */
  proposalSentAt?: string;
  /** Customer inquiry / request text (website forms, manual entry). */
  message?: string;
  /** CMS form submission that created this lead (website intake). */
  cmsFormSubmissionId?: string;
  /** CMS marketing package linked to this lead. */
  cmsPackageId?: string;
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
  entityId?: string;
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
  setRoleModuleRowAll: (roleId: string, module: RbacModuleKey, value: boolean) => void;
  setRoleModuleColumnAll: (
    roleId: string,
    permission: keyof RbacCrudSet,
    value: boolean,
  ) => void;
}

// Empty initial state — entity data comes from the CRM API.
const PLACEHOLDER_AGENCY: Agency = {
  id: '',
  name: '',
  subdomain: '',
  primaryColor: '#6366f1',
  secondaryColor: '#64748b',
  subscriptionPlan: 'GROWTH',
};

const defaultAgencies: Agency[] = [];
const defaultUsers: User[] = [];
const defaultCustomers: Customer[] = [];
const defaultLeads: Lead[] = [];
const defaultLeadActivities: LeadActivity[] = [];
const defaultLeadNotes: LeadNote[] = [];
const defaultLeadFollowups: LeadFollowup[] = [];
const defaultVendors: Vendor[] = [];
const defaultItineraries: Itinerary[] = [];
const defaultBookings: Booking[] = [];
const defaultInvoices: Invoice[] = [];
const defaultPayments: Payment[] = [];
const defaultExpenses: Expense[] = [];
const defaultVendorPayouts: VendorPayout[] = [];
const defaultAuditLogs: AuditLog[] = [];
const defaultRoleDefinitions: RoleDefinition[] = [];

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
  currentAgency: PLACEHOLDER_AGENCY,
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

  setRoleModuleRowAll: (roleId, module, value) => {
    const agencyId = get().currentAgency.id;
    if (!RBAC_MODULE_DEFS.some((d) => d.key === module)) return;
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
      const nextRow: RbacCrudSet = {
        view: value,
        create: value,
        edit: value,
        delete: value,
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

  setRoleModuleColumnAll: (roleId, permission, value) => {
    const agencyId = get().currentAgency.id;
    const permOk =
      permission === 'view' ||
      permission === 'create' ||
      permission === 'edit' ||
      permission === 'delete';
    if (!permOk) return;
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
      const permissions = { ...role.permissions };
      for (const { key } of RBAC_MODULE_DEFS) {
        const row = permissions[key];
        permissions[key] = row
          ? { ...row, [permission]: value }
          : {
              view: permission === 'view' ? value : false,
              create: permission === 'create' ? value : false,
              edit: permission === 'edit' ? value : false,
              delete: permission === 'delete' ? value : false,
            };
      }
      const nextDef: RoleDefinition = { ...role, permissions };
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
