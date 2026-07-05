'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { bookingTravellerLabel } from '@/lib/store';
import { useFinancePage } from '@/hooks/useFinancePage';
import { useClientPagination } from '@/hooks/useClientPagination';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { 
  Plus, 
  FileText, 
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
import { crmToastError, crmToastSuccess } from '@/lib/crm-toast-bus';

function generatePaymentTxnReference(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `TXN-${crypto.randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
    }
  } catch {
    /* ignore */
  }
  return `TXN-${Date.now()}`;
}

function formatBookingRef(bookingId: string): string {
  return bookingId.startsWith('book-') ? bookingId.replace('book-', '#') : `#${bookingId.slice(0, 8)}`;
}

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    invoices,
    payments,
    expenses,
    vendorPayouts,
    vendors,
    bookings,
    customers,
    itineraries,
    loading,
    backgroundLoading,
    error,
    addInvoice,
    recordPayment,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useFinancePage();

  const [activeTab, setActiveTab] = useState<'invoices' | 'expenses' | 'payouts'>('invoices');
  /** Opened invoice for detail drawer (row click or Actions) */
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Forms states
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');

  const [expAmount, setExpAmount] = useState('');
  const [expCat, setExpCat] = useState('MARKETING');
  const [expDesc, setExpDesc] = useState('');

  const [invBookingId, setInvBookingId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDueDate, setInvDueDate] = useState('');

  /** Weekly Ops: `/dashboard/finance?openInvoice=<id>` opens invoice detail. */
  useEffect(() => {
    const raw = searchParams.get('openInvoice')?.trim();
    if (!raw) return;
    const inv = invoices.find((i) => i.id === raw);
    if (!inv) return;
    setActiveTab('invoices');
    setInvoiceDetailId(raw);
    router.replace('/dashboard/finance', { scroll: false });
  }, [searchParams, invoices, router]);

  // API responses are already scoped to the logged-in agency via JWT.
  const agencyInvoices = invoices;
  const agencyPayments = payments;
  const agencyExpenses = expenses;
  const agencyPayouts = vendorPayouts;
  const agencyBookings = bookings;

  const invoicePagination = useClientPagination(agencyInvoices, undefined, [activeTab]);
  const expensePagination = useClientPagination(agencyExpenses, undefined, [activeTab]);
  const payoutPagination = useClientPagination(agencyPayouts, undefined, [activeTab]);

  // Totals
  const totalInvoiced = agencyInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const cashCollected = agencyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalExpenses = agencyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayouts = agencyPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const netProfit = cashCollected - totalExpenses;

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceDetailId || !payAmount) return;

    setPaymentError(null);
    const ref = payRef.trim() || generatePaymentTxnReference();
    try {
      await recordPayment(invoiceDetailId, Number(payAmount), payMethod, ref);
      setPayAmount('');
      setPayRef(generatePaymentTxnReference());
      crmToastSuccess('Payment recorded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record payment';
      setPaymentError(message);
      crmToastError(message);
    }
  };

  const closeInvoiceDetail = useCallback(() => {
    setInvoiceDetailId(null);
    setPayAmount('');
    setPayRef('');
  }, []);

  const invoiceDetail = useMemo(() => {
    if (!invoiceDetailId) return null;
    return agencyInvoices.find((i) => i.id === invoiceDetailId) ?? null;
  }, [invoiceDetailId, agencyInvoices]);

  const invoiceDetailContext = useMemo(() => {
    if (!invoiceDetail) return null;
    const booking = bookings.find((b) => b.id === invoiceDetail.bookingId);
    const travellerLabel = booking ? bookingTravellerLabel(booking, customers) : '—';
    const trip = booking ? itineraries.find((i) => i.id === booking.itineraryId) : undefined;
    const paymentLog = agencyPayments
      .filter((p) => p.invoiceId === invoiceDetail.id)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    const paidTotal = paymentLog.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number(invoiceDetail.amount) - paidTotal);
    return { booking, travellerLabel, trip, paymentLog, paidTotal, balance };
  }, [invoiceDetail, bookings, customers, itineraries, agencyPayments]);

  useEffect(() => {
    if (invoiceDetailId) {
      setPayRef(generatePaymentTxnReference());
    }
  }, [invoiceDetailId]);

  useEffect(() => {
    if (!invoiceDetailId) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeInvoiceDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invoiceDetailId, closeInvoiceDetail]);

  const resetExpenseForm = () => {
    setExpAmount('');
    setExpDesc('');
    setExpCat('MARKETING');
    setEditingExpenseId(null);
  };

  const openExpenseModal = (expenseId?: string) => {
    if (expenseId) {
      const exp = agencyExpenses.find((e) => e.id === expenseId);
      if (exp) {
        setEditingExpenseId(expenseId);
        setExpAmount(String(exp.amount));
        setExpCat(exp.category);
        setExpDesc(exp.description);
      }
    } else {
      resetExpenseForm();
    }
    setShowExpenseModal(true);
  };

  const handleRecordExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount) return;

    setActionError(null);
    try {
      const payload = { amount: Number(expAmount), category: expCat, description: expDesc };
      if (editingExpenseId) {
        await updateExpense(editingExpenseId, payload);
        crmToastSuccess('Expense updated');
      } else {
        await addExpense(payload);
        crmToastSuccess('Expense logged');
      }
      resetExpenseForm();
      setShowExpenseModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save expense';
      setActionError(message);
      crmToastError(message);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Remove this expense entry?')) return;
    setActionError(null);
    try {
      await deleteExpense(expenseId);
      crmToastSuccess('Expense deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense';
      setActionError(message);
      crmToastError(message);
    }
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invBookingId || !invNumber || !invAmount || !invDueDate) return;
    setActionError(null);
    try {
      const created = await addInvoice({
        bookingId: invBookingId,
        invoiceNumber: invNumber,
        amount: Number(invAmount),
        dueDate: invDueDate,
      });
      setShowInvoiceModal(false);
      setInvBookingId('');
      setInvNumber('');
      setInvAmount('');
      setInvDueDate('');
      setInvoiceDetailId(created.id);
      setActiveTab('invoices');
      crmToastSuccess('Invoice created');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice';
      setActionError(message);
      crmToastError(message);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="crm-alert-warning text-xs">
          {actionError}
        </p>
      ) : null}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">
            Billing & ERP Ledger Accounts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log partial payments, track vendor disbursement payouts, record company utilities, and calculate net margins.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setActionError(null);
              setShowInvoiceModal(true);
            }}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
          <button
            onClick={() => openExpenseModal()}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-white text-xs font-semibold flex items-center justify-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Expense</span>
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
        {/* Gross Invoiced */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gross Invoiced</span>
          <div>
            <span className="block text-xl font-bold mt-2 text-foreground">₹{totalInvoiced.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-muted-foreground">Total billings generated</span>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cash Receipts</span>
          <div>
            <span className="block text-xl font-bold mt-2 text-emerald-500">₹{cashCollected.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-emerald-500 font-semibold">
              {totalInvoiced > 0 ? Math.round((cashCollected / totalInvoiced) * 100) : 0}% collection index
            </span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Operational Expenses</span>
          <div>
            <span className="block text-xl font-bold mt-2 text-pink-500">₹{totalExpenses.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-muted-foreground">Logistics + Admin overheads</span>
          </div>
        </div>

        {/* Vendor Payouts */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Disbursed Payouts</span>
          <div>
            <span className="block text-xl font-bold mt-2 text-indigo-400">₹{totalPayouts.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-muted-foreground">Paid to service providers</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 bg-card border border-border rounded-xl flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gross Cash Profit</span>
          <div>
            <span className={`block text-xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ₹{netProfit.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-muted-foreground">Net current cash liquidity</span>
          </div>
        </div>
      </div>

      {/* Finance tables — full width */}
      <div className="text-xs">
        <CrmTablePanel
            tabs={[
              { id: 'invoices', label: 'Client Invoices' },
              { id: 'expenses', label: 'Expense Log' },
              { id: 'payouts', label: 'Vendor Payouts' },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as 'invoices' | 'expenses' | 'payouts')}
          >

          {/* Tab 1: Invoices */}
          {activeTab === 'invoices' && (
            <div className="crm-table-wrap">
            <div className="overflow-x-auto">
              <table className="crm-data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Booking</th>
                    <th>Traveller</th>
                    <th>Trip</th>
                    <th>Amount</th>
                    <th>Due</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-3">
                        <CrmTableSkeleton columns={8} rows={8} />
                      </td>
                    </tr>
                  ) : (
                  invoicePagination.pageItems.map((inv) => {
                    const booking = bookings.find((b) => b.id === inv.bookingId);
                    const travellerLabel =
                      booking != null ? bookingTravellerLabel(booking, customers) : '—';
                    const trip = booking
                      ? itineraries.find((i) => i.id === booking.itineraryId)
                      : undefined;
                    const openDetail = () => setInvoiceDetailId(inv.id);
                    return (
                    <tr
                      key={inv.id}
                      role="button"
                      tabIndex={0}
                      onClick={openDetail}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail();
                        }
                      }}
                      className="cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    >
                      <td className="font-semibold">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground">
                        {booking ? formatBookingRef(booking.id) : '—'}
                      </td>
                      <td className="text-muted-foreground max-w-[120px]">
                        {travellerLabel}
                      </td>
                      <td className="text-muted-foreground max-w-[140px] truncate" title={trip?.title}>
                        {trip?.title ?? '—'}
                      </td>
                      <td className="font-bold">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                      <td className="text-muted-foreground">{inv.dueDate}</td>
                      <td className="text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-amber-500/10 text-amber-500' :
                          inv.status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {inv.status !== 'PAID' ? (
                          <button
                            type="button"
                            onClick={() => setInvoiceDetailId(inv.id)}
                            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded font-bold text-[10px] transition-colors"
                          >
                            Record Payment
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setInvoiceDetailId(inv.id)}
                            className="px-2.5 py-1 text-muted-foreground hover:text-foreground font-semibold text-[10px] transition-colors"
                          >
                            View log
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                  })
                  )}
                  {!loading && agencyInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="crm-data-table__empty">No invoices recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <CrmTablePagination
              label="Invoices"
              rangeStart={invoicePagination.rangeStart}
              rangeEnd={invoicePagination.rangeEnd}
              total={invoicePagination.total}
              page={invoicePagination.page}
              totalPages={invoicePagination.totalPages}
              hasPrev={invoicePagination.hasPrev}
              hasNext={invoicePagination.hasNext}
              onPrev={invoicePagination.goPrev}
              onNext={invoicePagination.goNext}
              backgroundLoading={backgroundLoading}
            />
            </div>
          )}

          {/* Tab 2: Expenses */}
          {activeTab === 'expenses' && (
            <div className="crm-table-wrap">
            <div className="overflow-x-auto">
              <table className="crm-data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Date Logged</th>
                    <th className="text-right">Debit Amount</th>
                    <th className="text-right w-16"> </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-3">
                        <CrmTableSkeleton columns={5} rows={8} />
                      </td>
                    </tr>
                  ) : (
                  expensePagination.pageItems.map((exp) => (
                    <tr key={exp.id}>
                      <td className="font-semibold">
                        <span className="crm-table-badge">{exp.category}</span>
                      </td>
                      <td className="text-muted-foreground">{exp.description || 'General expense'}</td>
                      <td className="text-muted-foreground">
                        {new Date(exp.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="text-right font-bold text-pink-500">
                        -₹{Number(exp.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openExpenseModal(exp.id)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Edit expense"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
                  {!loading && agencyExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="crm-data-table__empty">No business expenses logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <CrmTablePagination
              label="Expenses"
              rangeStart={expensePagination.rangeStart}
              rangeEnd={expensePagination.rangeEnd}
              total={expensePagination.total}
              page={expensePagination.page}
              totalPages={expensePagination.totalPages}
              hasPrev={expensePagination.hasPrev}
              hasNext={expensePagination.hasNext}
              onPrev={expensePagination.goPrev}
              onNext={expensePagination.goNext}
              backgroundLoading={backgroundLoading}
            />
            </div>
          )}

          {/* Tab 3: Vendor Payouts */}
          {activeTab === 'payouts' && (
            <div className="crm-table-wrap">
            <div className="overflow-x-auto">
              <table className="crm-data-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>Disbursement Vendor</th>
                    <th>Payout Date</th>
                    <th className="text-right">Debit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-3">
                        <CrmTableSkeleton columns={3} rows={8} />
                      </td>
                    </tr>
                  ) : (
                  payoutPagination.pageItems.map((pout) => {
                    const vendor = vendors.find(v => v.id === pout.vendorId);
                    return (
                      <tr key={pout.id}>
                        <td className="font-semibold">
                          <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                            {vendor?.name.charAt(0) || 'V'}
                          </div>
                          <span>{vendor?.name || 'Partner Provider'}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground">
                          {new Date(pout.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="text-right font-bold text-indigo-400">
                          -₹{Number(pout.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })
                  )}
                  {!loading && agencyPayouts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="crm-data-table__empty">
                        No vendor payouts recorded. Disburse payouts from the Vendors page.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <CrmTablePagination
              label="Vendor payouts"
              rangeStart={payoutPagination.rangeStart}
              rangeEnd={payoutPagination.rangeEnd}
              total={payoutPagination.total}
              page={payoutPagination.page}
              totalPages={payoutPagination.totalPages}
              hasPrev={payoutPagination.hasPrev}
              hasNext={payoutPagination.hasNext}
              onPrev={payoutPagination.goPrev}
              onNext={payoutPagination.goNext}
              backgroundLoading={backgroundLoading}
            />
            </div>
          )}
          </CrmTablePanel>
      </div>

      {/* Invoice detail: details + record receipt (left) · payment log (right) */}
      {invoiceDetail && invoiceDetailContext && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeInvoiceDetail}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-detail-title"
            className="w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl text-xs my-6 flex flex-col max-h-[min(90vh,880px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5 shrink-0">
              <div>
                <h2 id="invoice-detail-title" className="text-sm font-bold text-foreground">
                  Invoice {invoiceDetail.invoiceNumber}
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Internal id · {invoiceDetail.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInvoiceDetail}
                className="p-1.5 rounded-lg hover:bg-secondary border border-transparent hover:border-border"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-border overflow-y-auto min-h-0 flex-1">
              {/* Left: record details + receipt form */}
              <div className="p-4 sm:p-5 space-y-5">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Record details
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <dt className="text-muted-foreground">Booking</dt>
                      <dd className="font-mono text-foreground">
                        {invoiceDetailContext.booking
                          ? formatBookingRef(invoiceDetailContext.booking.id)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Traveller</dt>
                      <dd className="text-foreground">
                        {invoiceDetailContext.travellerLabel}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Trip</dt>
                      <dd className="text-foreground line-clamp-2" title={invoiceDetailContext.trip?.description}>
                        {invoiceDetailContext.trip?.title ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Invoice amount</dt>
                      <dd className="font-bold text-foreground">
                        ₹{Number(invoiceDetail.amount).toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Amount received</dt>
                      <dd className="font-bold text-emerald-500">
                        ₹{invoiceDetailContext.paidTotal.toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Balance</dt>
                      <dd className="font-bold text-amber-500">
                        ₹{invoiceDetailContext.balance.toLocaleString('en-IN')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Due date</dt>
                      <dd className="text-foreground">{invoiceDetail.dueDate}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            invoiceDetail.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : invoiceDetail.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-500/10 text-amber-500'
                                : invoiceDetail.status === 'OVERDUE'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {invoiceDetail.status}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {invoiceDetail.status !== 'PAID' ? (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Record receipt
                    </h3>
                    <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
                      <div>
                        <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Received amount (₹)
                        </label>
                        <input
                          type="number"
                          required
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="120000"
                          className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Payment method
                        </label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                        >
                          <option value="BANK_TRANSFER">Bank wire transfer</option>
                          <option value="CARD">Credit / debit card</option>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                          Transaction reference
                        </label>
                        <input
                          type="text"
                          readOnly
                          tabIndex={-1}
                          aria-readonly="true"
                          value={payRef}
                          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border font-mono text-[11px] text-foreground cursor-default"
                        />
                        <p className="text-[9px] text-muted-foreground mt-1">
                          Auto-generated for this receipt — a fresh reference is created after each log.
                        </p>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                        >
                          Log receipt
                        </button>
                      </div>
                      {paymentError ? (
                        <p className="text-[10px] text-destructive">{paymentError}</p>
                      ) : null}
                    </form>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
                    This invoice is marked paid. Add adjustments in Billing if totals need correction.
                  </p>
                )}
              </div>

              {/* Right: payment log */}
              <div className="p-4 sm:p-5 flex flex-col min-h-[280px] lg:min-h-0 bg-secondary/15">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 shrink-0">
                  Payment log
                </h3>
                {invoiceDetailContext.paymentLog.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No payments recorded yet.</p>
                ) : (
                  <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {invoiceDetailContext.paymentLog.map((pay) => (
                      <li
                        key={pay.id}
                        className="rounded-lg border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm"
                      >
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-foreground tabular-nums">
                            ₹{Number(pay.amount).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(pay.paymentDate).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span className="font-semibold uppercase text-[9px] text-primary">
                            {pay.paymentMethod.replace(/_/g, ' ')}
                          </span>
                          {pay.transactionReference ? (
                            <span className="font-mono truncate max-w-[200px]" title={pay.transactionReference}>
                              Ref: {pay.transactionReference}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-t border-border p-4 sm:p-5 flex justify-end shrink-0">
              <button
                type="button"
                onClick={closeInvoiceDetail}
                className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">
                {editingExpenseId ? 'Edit Business Overhead' : 'Log Business Overhead'}
              </h2>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  resetExpenseForm();
                }}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordExpenseSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Overhead Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="15000"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Overhead Category
                </label>
                <select
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                >
                  <option value="MARKETING">Marketing & Client Ads</option>
                  <option value="SALARIES">Employee Salaries</option>
                  <option value="UTILITIES">Database & Software Subscriptions</option>
                  <option value="TRAVEL_DOCS">Visa and Travel Passports Procurement</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Overhead Details
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Kashmir campaign creative spend"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    resetExpenseForm();
                  }}
                  className="px-4 py-2 rounded hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {editingExpenseId ? 'Save changes' : 'Log Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">New Client Invoice</h2>
              <button onClick={() => setShowInvoiceModal(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Booking
                </label>
                <select
                  required
                  value={invBookingId}
                  onChange={(e) => setInvBookingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                >
                  <option value="">Select booking…</option>
                  {agencyBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatBookingRef(b.id)} · {bookingTravellerLabel(b, customers)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Invoice number
                </label>
                <input
                  type="text"
                  required
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  placeholder="INV-2026-001"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  placeholder="150000"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Due date
                </label>
                <DatePickerInput
                  required
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  inputClassName="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 rounded hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Create invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
