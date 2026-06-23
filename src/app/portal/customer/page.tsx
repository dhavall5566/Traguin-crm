'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import ClientProposalView from '@/components/proposal/ClientProposalView';
import { resolveProposalTheme } from '@/lib/proposalThemes';
import {
  Compass,
  Upload,
  Shield,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';

export default function CustomerPortal() {
  const searchParams = useSearchParams();
  const itinParamId = searchParams.get('itin') || '';
  const themeParam = searchParams.get('theme') || '';

  const { itineraries, customers, bookings, invoices, agencies } = useStore();
  const [itinId, setItinId] = useState(itinParamId);
  const [uploaded, setUploaded] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [docName, setDocName] = useState('');

  const activeItinerary = itineraries.find((i) => i.id === itinId) || itineraries[0];
  const agency = agencies.find((a) => a.id === activeItinerary?.agencyId);
  const clientProfile = customers.find((c) => c.id === activeItinerary?.customerId);
  const activeBooking = bookings.find((b) => b.itineraryId === activeItinerary?.id);
  const activeInvoice = invoices.find((inv) => inv.bookingId === activeBooking?.id);
  const proposalTheme = resolveProposalTheme(themeParam || activeItinerary?.proposalTheme);
  const clientName = clientProfile
    ? `${clientProfile.firstName} ${clientProfile.lastName}`
    : undefined;

  useEffect(() => {
    if (itinParamId) {
      setItinId(itinParamId);
    }
  }, [itinParamId]);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientProfile || !docName.trim()) return;

    useStore.getState().uploadCustomerDoc(clientProfile.id, {
      name: docName,
      category: 'Visa Proof',
      size: '1.4 MB',
    });

    setDocName('');
    setUploaded(true);
    setTimeout(() => setUploaded(false), 2500);
  };

  const handleMockPayment = () => {
    if (!activeInvoice) return;
    useStore.getState().recordPayment(activeInvoice.id, activeInvoice.amount, 'CARD', 'PORTAL-CARD-PAY');
    setPaymentRecorded(true);
    setTimeout(() => setPaymentRecorded(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-zinc-900 bg-zinc-900/60 backdrop-blur-xl px-6 py-4 flex justify-between items-center max-w-6xl mx-auto w-full z-20">
        <div className="flex items-center space-x-2.5">
          {agency?.logoUrl ? (
            <img src={agency.logoUrl} alt={agency.name} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <span className="font-bold tracking-tight text-xs block text-zinc-200">
              {agency?.name ?? 'Travel Portal'}
            </span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Secure Client Portal</span>
          </div>
        </div>
        <Link
          href="/auth/login"
          className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold transition-colors text-xs"
        >
          Agency Staff Login
        </Link>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 text-xs items-start">
        <div className="lg:col-span-2">
          {activeItinerary ? (
            <ClientProposalView
              itinerary={activeItinerary}
              themeId={proposalTheme}
              agencyName={agency?.name}
              agencyLogoUrl={agency?.logoUrl}
              clientName={clientName}
              showPricing
            />
          ) : (
            <div className="text-center py-20 bg-zinc-900/40 border border-zinc-800 rounded-2xl text-zinc-400">
              Please open a valid itinerary proposal link from your travel agent.
            </div>
          )}
        </div>

        <div className="space-y-6">
          {activeBooking && (
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <h3 className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2">
                Booking Operations Tracker
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Status:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider text-[9px]">
                    {activeBooking.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Confirmation Code:</span>
                  <span className="font-mono text-zinc-200">{activeBooking.hotelConfirmationCode || 'Awaiting'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Driver Coordinator:</span>
                  <span className="text-zinc-200">{activeBooking.driverName || 'Not Assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Visa Processing:</span>
                  <span className="text-zinc-300 font-medium">{activeBooking.visaStatus || 'Pending details'}</span>
                </div>
              </div>
            </div>
          )}

          {activeInvoice && (
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <h3 className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2">
                Secure Invoice Payment
              </h3>

              {paymentRecorded && (
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 text-center animate-pulse">
                  Payment recorded successfully!
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Invoice Number:</span>
                  <span className="font-semibold text-zinc-200">{activeInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Amount Due:</span>
                  <span className="font-bold text-zinc-200">
                    ₹{Number(activeInvoice.amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Status:</span>
                  <span
                    className={`font-bold text-[9px] uppercase ${
                      activeInvoice.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {activeInvoice.status}
                  </span>
                </div>

                {activeInvoice.status !== 'PAID' && (
                  <button
                    type="button"
                    onClick={handleMockPayment}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/15 mt-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Invoice Balance</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {clientProfile && (
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <h3 className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2">
                Travel Document Upload
              </h3>

              {uploaded && (
                <div className="p-2 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20 text-center">
                  Document uploaded securely.
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-3">
                <div>
                  <label className="block text-[9px] text-zinc-500 font-bold uppercase mb-1">
                    Upload Visa Scan / Proof
                  </label>
                  <input
                    type="text"
                    required
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="e.g. kashmir_permit.pdf"
                    className="w-full px-2.5 py-1.5 rounded bg-zinc-800/60 border border-zinc-700/50 focus:outline-none text-[11px]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg font-bold flex items-center justify-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </form>
            </div>
          )}

          <div className="p-4 bg-zinc-900/20 border border-zinc-800 rounded-xl text-[10px] text-zinc-500 flex items-center space-x-2">
            <Shield className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>Your session is encrypted and isolated for secure document exchange.</span>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-4 text-center text-[9px] text-zinc-600">
        <p>© 2026 {agency?.name ?? 'AeroERP'}. All rights reserved.</p>
      </footer>
    </div>
  );
}
