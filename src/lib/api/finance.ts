import { crmFetch, crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";
import type { Expense, Invoice, Payment, VendorPayout } from "@/lib/store";

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type ApiInvoiceRead = {
  id: string;
  agency_id: string;
  booking_id: string;
  invoice_number: string;
  amount: number | string;
  due_date: string;
  status: string;
  created_at: string;
};

export type ApiPaymentRead = {
  id: string;
  agency_id: string;
  invoice_id: string;
  amount: number | string;
  payment_method: string;
  transaction_reference: string | null;
  payment_date: string;
};

export type ApiExpenseRead = {
  id: string;
  agency_id: string;
  booking_id: string | null;
  amount: number | string;
  category: string;
  description: string | null;
  expense_date: string;
};

export type ApiVendorPayoutRead = {
  id: string;
  agency_id: string;
  vendor_id: string;
  amount: number | string;
  payment_date: string;
  status: string;
};

export function mapInvoiceFromApi(api: ApiInvoiceRead): Invoice {
  return {
    id: api.id,
    agencyId: api.agency_id,
    bookingId: api.booking_id,
    invoiceNumber: api.invoice_number,
    amount: Number(api.amount),
    dueDate: api.due_date.slice(0, 10),
    status: api.status as Invoice["status"],
  };
}

export function mapPaymentFromApi(api: ApiPaymentRead): Payment {
  return {
    id: api.id,
    agencyId: api.agency_id,
    invoiceId: api.invoice_id,
    amount: Number(api.amount),
    paymentMethod: api.payment_method,
    transactionReference: api.transaction_reference ?? undefined,
    paymentDate: api.payment_date,
  };
}

export function mapExpenseFromApi(api: ApiExpenseRead): Expense {
  return {
    id: api.id,
    agencyId: api.agency_id,
    amount: Number(api.amount),
    category: api.category,
    description: api.description ?? "",
    expenseDate: api.expense_date,
  };
}

export function mapVendorPayoutFromApi(api: ApiVendorPayoutRead): VendorPayout {
  return {
    id: api.id,
    agencyId: api.agency_id,
    vendorId: api.vendor_id,
    amount: Number(api.amount),
    paymentDate: api.payment_date,
  };
}

export async function listInvoices(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiInvoiceRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiInvoiceRead>>(
    `/api/crm/finance/invoices${qs ? `?${qs}` : ""}`,
  );
}

export async function getInvoice(id: string): Promise<ApiInvoiceRead> {
  return crmFetchJson<ApiInvoiceRead>(`/api/crm/finance/invoices/${id}`);
}

export type InvoiceCreateInput = {
  bookingId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status?: Invoice["status"];
};

export async function createInvoice(input: InvoiceCreateInput): Promise<ApiInvoiceRead> {
  return crmFetchJson<ApiInvoiceRead>("/api/crm/finance/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking_id: input.bookingId,
      invoice_number: input.invoiceNumber,
      amount: input.amount,
      due_date: input.dueDate,
      status: input.status ?? "UNPAID",
    }),
  });
}

export type InvoiceUpdateInput = Partial<{
  bookingId: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: Invoice["status"];
}>;

export async function updateInvoice(id: string, input: InvoiceUpdateInput): Promise<ApiInvoiceRead> {
  const body: Record<string, unknown> = {};
  if (input.bookingId !== undefined) body.booking_id = input.bookingId;
  if (input.invoiceNumber !== undefined) body.invoice_number = input.invoiceNumber;
  if (input.amount !== undefined) body.amount = input.amount;
  if (input.dueDate !== undefined) body.due_date = input.dueDate;
  if (input.status !== undefined) body.status = input.status;
  return crmFetchJson<ApiInvoiceRead>(`/api/crm/finance/invoices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/finance/invoices/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === "string" ? payload.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

export async function listPayments(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiPaymentRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiPaymentRead>>(
    `/api/crm/finance/payments${qs ? `?${qs}` : ""}`,
  );
}

export async function createPayment(input: {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
}): Promise<ApiPaymentRead> {
  return crmFetchJson<ApiPaymentRead>("/api/crm/finance/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoice_id: input.invoiceId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      transaction_reference: input.transactionReference ?? null,
    }),
  });
}

export async function listExpenses(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiExpenseRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiExpenseRead>>(
    `/api/crm/finance/expenses${qs ? `?${qs}` : ""}`,
  );
}

export type ExpenseCreateInput = {
  amount: number;
  category: string;
  description?: string;
  bookingId?: string;
};

export async function createExpense(input: ExpenseCreateInput): Promise<ApiExpenseRead> {
  return crmFetchJson<ApiExpenseRead>("/api/crm/finance/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amount,
      category: input.category,
      description: input.description || null,
      booking_id: input.bookingId ?? null,
    }),
  });
}

export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

export async function updateExpense(id: string, input: ExpenseUpdateInput): Promise<ApiExpenseRead> {
  const body: Record<string, unknown> = {};
  if (input.amount !== undefined) body.amount = input.amount;
  if (input.category !== undefined) body.category = input.category;
  if (input.description !== undefined) body.description = input.description || null;
  if (input.bookingId !== undefined) body.booking_id = input.bookingId ?? null;
  return crmFetchJson<ApiExpenseRead>(`/api/crm/finance/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const response = await crmFetch(`/api/crm/finance/expenses/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === "string" ? payload.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
}

export async function listVendorPayouts(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<ApiVendorPayoutRead>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<ApiVendorPayoutRead>>(
    `/api/crm/finance/vendor-payouts${qs ? `?${qs}` : ""}`,
  );
}

export async function createVendorPayout(input: {
  vendorId: string;
  amount: number;
}): Promise<ApiVendorPayoutRead> {
  return crmFetchJson<ApiVendorPayoutRead>("/api/crm/finance/vendor-payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vendor_id: input.vendorId,
      amount: input.amount,
      status: "PAID",
    }),
  });
}
