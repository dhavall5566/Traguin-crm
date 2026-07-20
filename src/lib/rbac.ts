/**
 * RBAC module keys line up with the workspace matrix and sidebar gate checks.
 */
export const RBAC_DEFINITIONS_STORAGE_KEY = 'travelcrm:roleDefinitions';

export const RBAC_MODULE_DEFS = [
  { key: 'analytics', label: 'Analytics Dashboard' },
  { key: 'leads', label: 'Leads CRM Pipeline' },
  { key: 'customers', label: 'Customer Database' },
  { key: 'itinerary', label: 'Itinerary Planner' },
  { key: 'vendors', label: 'Vendor Registry' },
  { key: 'finance', label: 'Financial Ledgers' },
  { key: 'staff_control', label: 'Access & Staff Control' },
  { key: 'workspace_settings', label: 'Workspace Settings' },
] as const;

export type RbacModuleKey = (typeof RBAC_MODULE_DEFS)[number]['key'];

export type RbacCrudSet = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type RoleDefinition = {
  id: string;
  agencyId: string;
  /** Display name – must match User.role assignments */
  name: string;
  /** Seed roles shipped with demos; custom roles may be deleted if unused */
  isSystem: boolean;
  permissions: Record<RbacModuleKey, RbacCrudSet>;
};

export const RBAC_NAV_MODULE: Record<string, RbacModuleKey> = {
  '/dashboard': 'analytics',
  '/dashboard/operations': 'itinerary',
  '/dashboard/crm': 'leads',
  '/dashboard/customers': 'customers',
  '/dashboard/bookings': 'customers',
  '/dashboard/packages': 'itinerary',
  '/dashboard/itinerary': 'itinerary',
  '/dashboard/vendors': 'vendors',
  '/dashboard/finance': 'finance',
  '/dashboard/employees': 'staff_control',
  '/dashboard/settings': 'workspace_settings',
  '/dashboard/settings/general': 'workspace_settings',
  '/dashboard/settings/email-setup': 'workspace_settings',
  '/dashboard/settings/smtp': 'workspace_settings',
  '/dashboard/settings/email': 'workspace_settings',
  '/dashboard/settings/whatsapp': 'workspace_settings',
};

/** Sidebar label → module key used for MENU visibility only (inherits from CRM matrix row). */
export type NavRbacItem = RbacModuleKey;

function mk(
  view: boolean,
  create: boolean,
  edit: boolean,
  del: boolean,
): RbacCrudSet {
  return { view, create, edit, delete: del };
}

/** Full allow */
const all = (): RbacCrudSet => mk(true, true, true, true);

function emptyDeny(): Record<RbacModuleKey, RbacCrudSet> {
  const o = {} as Record<RbacModuleKey, RbacCrudSet>;
  for (const { key } of RBAC_MODULE_DEFS) {
    o[key] = mk(false, false, false, false);
  }
  return o;
}

type SeedPreset = Partial<Record<RbacModuleKey, RbacCrudSet>>;

/** Merge preset into full deny-by-default shell */
function fromPreset(p: SeedPreset): Record<RbacModuleKey, RbacCrudSet> {
  const base = emptyDeny();
  for (const { key } of RBAC_MODULE_DEFS) {
    if (p[key]) base[key] = p[key]!;
  }
  return base;
}

/** Seed aligns with legacy employees/page matrix plus workspace Settings row */
const SYSTEM_ROLE_SEEDS: Record<string, SeedPreset> = {
  'Agency Admin': {
    analytics: all(),
    leads: all(),
    customers: all(),
    itinerary: all(),
    vendors: all(),
    finance: all(),
    staff_control: all(),
    workspace_settings: all(),
  },
  'Sales Agent': {
    analytics: mk(true, false, false, false),
    leads: mk(true, true, true, false),
    customers: mk(true, true, true, false),
    itinerary: mk(true, true, true, false),
    workspace_settings: mk(true, false, false, false),
  },
  Operations: {
    analytics: mk(true, false, false, false),
    customers: mk(true, true, true, false),
    itinerary: mk(true, true, true, false),
    vendors: mk(true, true, true, false),
    workspace_settings: mk(true, false, false, false),
  },
  Finance: {
    analytics: mk(true, false, false, false),
    vendors: mk(true, false, false, false),
    finance: mk(true, true, true, false),
    workspace_settings: mk(true, false, false, false),
  },
  Vendor: {
    vendors: mk(true, false, false, false),
    workspace_settings: mk(false, false, false, false),
  },
  Customer: {
    workspace_settings: mk(false, false, false, false),
  },
};

const SYSTEM_ROLE_ORDER = [
  'Agency Admin',
  'Sales Agent',
  'Operations',
  'Finance',
  'Vendor',
  'Customer',
] as const;

export function slugRoleId(agencyId: string, roleName: string): string {
  const slug = roleName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '');
  return `role-sys-${agencyId}-${slug || 'unnamed'}`;
}

export function createDefaultRoleDefinitionsForAgency(agencyId: string): RoleDefinition[] {
  const out: RoleDefinition[] = [];
  for (const name of SYSTEM_ROLE_ORDER) {
    const preset = SYSTEM_ROLE_SEEDS[name];
    if (!preset) continue;
    out.push({
      id: slugRoleId(agencyId, name),
      agencyId,
      name,
      isSystem: true,
      permissions: fromPreset(preset),
    });
  }
  return out;
}

export function canAccessModuleView(
  roleName: string,
  agencyId: string,
  module: RbacModuleKey,
  definitions: RoleDefinition[],
): boolean {
  const def = definitions.find((r) => r.agencyId === agencyId && r.name === roleName);
  return def?.permissions?.[module]?.view === true;
}

export function duplicateRolePermissions(src: RoleDefinition): Record<RbacModuleKey, RbacCrudSet> {
  const o = {} as Record<RbacModuleKey, RbacCrudSet>;
  for (const { key } of RBAC_MODULE_DEFS) {
    const p = src.permissions[key];
    o[key] = p ? { ...p } : mk(false, false, false, false);
  }
  return o;
}

/** Default matrix for manually created roles (deny-all until tuned). */
export function permissionsAllDenied(): Record<RbacModuleKey, RbacCrudSet> {
  return emptyDeny();
}

export function isAgencyAdmin(roleName: string): boolean {
  return roleName === 'Agency Admin';
}

export function canManageRoleDefinitions(
  roleName: string,
  agencyId: string,
  definitions: RoleDefinition[],
): boolean {
  if (roleName === 'Agency Admin') return true;
  const def = definitions.find((r) => r.agencyId === agencyId && r.name === roleName);
  const p = def?.permissions?.staff_control;
  return !!(p?.create || p?.edit);
}
