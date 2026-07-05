import type { Customer } from "@/lib/store";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import {
  CRM_CACHE,
  getCrmWorkspaceList,
  prependCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import { getCustomer, mapCustomerFromApi } from "@/lib/api/customers";

type CustomerUpsertListener = (customer: Customer) => void;
const listeners = new Set<CustomerUpsertListener>();

/** Subscribe when another module adds a customer to the workspace cache. */
export function onCustomerWorkspaceUpsert(listener: CustomerUpsertListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fetch a customer by id and merge into the Customers tab cache (if missing). */
export async function upsertCustomerInWorkspace(
  customerId: string | null | undefined,
): Promise<Customer | null> {
  const id = (customerId ?? "").trim();
  if (!id) return null;

  const cached = getCrmWorkspaceList<Customer>(CRM_CACHE.customers);
  const existing = cached?.items.find((row) => row.id === id);
  if (existing) return existing;

  const apiCustomer = await getCustomer(id);
  const record = mapCustomerFromApi(apiCustomer);
  prependCrmWorkspaceItem(CRM_CACHE.customers, record);
  invalidateCrmListCache(CRM_CACHE.customers);
  listeners.forEach((listener) => listener(record));
  return record;
}
