/** Session-scoped merged list cache — survives route changes for instant tab return. */
export const CRM_WORKSPACE_TTL_MS = 180_000;

type WorkspaceEntry = {
  items: unknown[];
  total: number;
  ts: number;
};

const STORE = new Map<string, WorkspaceEntry>();

export function getCrmWorkspaceList<T>(prefix: string, maxAgeMs = CRM_WORKSPACE_TTL_MS): {
  items: T[];
  total: number;
} | null {
  const entry = STORE.get(prefix);
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) return null;
  return { items: entry.items as T[], total: entry.total };
}

export function setCrmWorkspaceList<T>(prefix: string, items: T[], total?: number): void {
  STORE.set(prefix, {
    items,
    total: total ?? items.length,
    ts: Date.now(),
  });
}

export function patchCrmWorkspaceItem(
  prefix: string,
  id: string,
  patch: object,
): void {
  const entry = STORE.get(prefix);
  if (!entry) return;
  STORE.set(prefix, {
    ...entry,
    items: entry.items.map((item) =>
      (item as { id: string }).id === id ? { ...(item as object), ...patch } : item,
    ),
    ts: Date.now(),
  });
}

export function removeCrmWorkspaceItem(prefix: string, id: string): void {
  const entry = STORE.get(prefix);
  if (!entry) return;
  const items = entry.items.filter((item) => (item as { id: string }).id !== id);
  STORE.set(prefix, {
    items,
    total: Math.max(0, entry.total - 1),
    ts: Date.now(),
  });
}

export function prependCrmWorkspaceItem<T extends { id: string }>(prefix: string, item: T): void {
  const entry = STORE.get(prefix);
  if (!entry) {
    setCrmWorkspaceList(prefix, [item], 1);
    return;
  }
  const items = [item, ...(entry.items as T[]).filter((row) => row.id !== item.id)];
  STORE.set(prefix, {
    items,
    total: entry.total + 1,
    ts: Date.now(),
  });
}

export function invalidateCrmWorkspace(prefix?: string): void {
  if (!prefix) {
    STORE.clear();
    return;
  }
  STORE.delete(prefix);
}

/** Canonical cache keys shared across CRM modules. */
export const CRM_CACHE = {
  leads: "leads",
  customers: "customers",
  vendors: "vendors",
  itineraries: "itineraries",
  bookings: "bookings",
  invoices: "invoices",
  payments: "payments",
  expenses: "expenses",
  vendorPayouts: "vendor-payouts",
  auditLogs: "audit-logs",
} as const;

export type CrmCacheKey = (typeof CRM_CACHE)[keyof typeof CRM_CACHE];
