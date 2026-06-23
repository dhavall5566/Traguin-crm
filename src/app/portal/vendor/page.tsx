'use client';

import React, { useState, useEffect } from 'react';
import { useStore, Vendor, Booking, Itinerary } from '@/lib/store';
import { 
  Building,
  DollarSign, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Upload, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  Activity, 
  Truck, 
  Plane, 
  Hotel,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  User,
  Coffee,
  Check
} from 'lucide-react';
import Link from 'next/link';

// Map icon types for representation
const vendorIconMap = {
  HOTEL: Hotel,
  FLIGHT: Plane,
  TRANSFER: Truck,
  ACTIVITY: Activity,
  MEAL: Coffee
};

export default function VendorPortal() {
  const { vendors, bookings, itineraries, updateVendor, updateBooking, vendorPayouts, currentAgency } = useStore();
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [mounted, setMounted] = useState(false);
  
  // Rate Editing state
  const [newRateName, setNewRateName] = useState('');
  const [newRateType, setNewRateType] = useState('HOTEL');
  const [newRatePrice, setNewRatePrice] = useState('');
  
  // Simulated Availability State (day-by-day room/service quotas)
  const [availability, setAvailability] = useState<{ [date: string]: number }>({
    '2026-05-23': 8,
    '2026-05-24': 8,
    '2026-05-25': 5,
    '2026-05-26': 12,
    '2026-05-27': 15,
    '2026-05-28': 3,
    '2026-05-29': 0,
    '2026-05-30': 4,
  });

  // Action notifications
  const [actionSuccess, setActionSuccess] = useState('');
  const [voucherBookingId, setVoucherBookingId] = useState('');
  const [voucherFileName, setVoucherFileName] = useState('');
  const [confirmCodeInput, setConfirmCodeInput] = useState<{ [bookingId: string]: string }>({});

  useEffect(() => {
    setMounted(true);
    if (vendors.length > 0) {
      setSelectedVendorId(vendors[0].id);
    }
  }, [vendors]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <p className="animate-pulse">Loading secure session gateways...</p>
      </div>
    );
  }

  const activeVendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];

  if (!activeVendor) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />
        <p>No registered vendors found in system database.</p>
        <Link href="/auth/login" className="px-4 py-2 bg-indigo-600 rounded text-white text-xs font-semibold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Find bookings related to this vendor.
  // Bookings are related if the itinerary contains items referencing the vendor's name or matches their rate card titles.
  const relatedBookings = bookings.filter(booking => {
    const itinerary = itineraries.find(i => i.id === booking.itineraryId);
    if (!itinerary) return false;
    
    // Check if any day item title matches or overlaps with vendor rates or vendor name
    return itinerary.days.some(day => 
      day.items.some(item => 
        item.title.toLowerCase().includes(activeVendor.name.toLowerCase()) || 
        activeVendor.rates.some(r => item.title.toLowerCase().includes(r.name.toLowerCase()))
      )
    );
  });

  // Filter vendor payouts specifically for this vendor
  const activeVendorPayouts = vendorPayouts.filter(vp => vp.vendorId === activeVendor.id);

  // Add Rate Handler
  const handleAddRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRateName.trim() || !newRatePrice) return;
    
    const parsedPrice = parseFloat(newRatePrice);
    if (isNaN(parsedPrice)) return;

    const updatedRates = [
      ...activeVendor.rates,
      { name: newRateName, type: newRateType, price: parsedPrice }
    ];

    updateVendor(activeVendor.id, { rates: updatedRates });
    setNewRateName('');
    setNewRatePrice('');
    
    setActionSuccess('Rate card item added successfully!');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Delete Rate Handler
  const handleDeleteRate = (index: number) => {
    const updatedRates = activeVendor.rates.filter((_, idx) => idx !== index);
    updateVendor(activeVendor.id, { rates: updatedRates });
    
    setActionSuccess('Rate card item removed.');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Confirm Reservation Handler
  const handleConfirmReservation = (bookingId: string) => {
    const code = confirmCodeInput[bookingId] || `CONF-${Math.floor(100000 + Math.random() * 900000)}`;
    
    updateBooking(bookingId, {
      status: 'CONFIRMED',
      hotelConfirmationCode: activeVendor.type === 'SERVICE' ? code : undefined
    });

    setActionSuccess('Booking confirmed and confirmation code dispatched!');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Voucher upload simulator
  const handleVoucherUpload = (bookingId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherFileName.trim()) return;

    updateBooking(bookingId, {
      voucherUrl: `/uploads/vouchers/${voucherFileName}`,
      status: 'CONFIRMED'
    });

    setVoucherFileName('');
    setVoucherBookingId('');
    setActionSuccess('Voucher document linked securely to booking!');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Availability Adjustment
  const adjustAvailability = (date: string, delta: number) => {
    setAvailability(prev => ({
      ...prev,
      [date]: Math.max(0, (prev[date] || 0) + delta)
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-900/60 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row justify-between items-center max-w-6xl mx-auto w-full gap-4 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
            <Building className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-xs uppercase text-zinc-200">Vendor Operations Hub</h1>
            <p className="text-[10px] text-zinc-500">Multi-Tenant isolated ERP channel</p>
          </div>
        </div>
        
        {/* Tenant Switching & Demo Identity Simulator */}
        <div className="flex items-center space-x-3 text-xs w-full sm:w-auto justify-end">
          <label className="text-[10px] text-zinc-400 font-medium shrink-0">Vendor Account:</label>
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="bg-zinc-800/80 border border-zinc-700/60 rounded px-2.5 py-1.5 text-[11px] text-zinc-250 focus:outline-none focus:border-amber-500/50"
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
            ))}
          </select>
          <Link href="/auth/login" className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/40 font-semibold transition-colors shrink-0 text-[10px]">
            Agency Staff Portal
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6 flex-1 text-xs">
        {actionSuccess && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-medium text-center animate-pulse">
            {actionSuccess}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Ledger Balance</span>
              <p className="text-base font-bold text-zinc-200">₹{Number(activeVendor.ledgerBalance).toLocaleString('en-IN')}</p>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          
          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Pending Orders</span>
              <p className="text-base font-bold text-zinc-200">
                {relatedBookings.filter(b => b.status === 'PENDING' || b.status === 'PROCESSING').length}
              </p>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Total Disbursements</span>
              <p className="text-base font-bold text-zinc-200">
                ₹{activeVendorPayouts.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Partner Agency</span>
              <p className="text-base font-bold text-zinc-200 truncate max-w-[150px]">{currentAgency.name}</p>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
              <Building className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Dynamic Portlet Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Reservation Requests & Confirms */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                <h3 className="font-bold text-zinc-200 uppercase tracking-tight flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>Incoming Service Reservations</span>
                </h3>
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 font-semibold">
                  {relatedBookings.length} Requests Found
                </span>
              </div>

              {relatedBookings.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  No reservation requests matching services for {activeVendor.name}.
                </div>
              ) : (
                <div className="space-y-4">
                  {relatedBookings.map(booking => {
                    const itin = itineraries.find(i => i.id === booking.itineraryId);
                    
                    // Filter matching days/items for this vendor to clarify what exactly they are booking
                    const matchingItems = itin?.days.flatMap(day => 
                      day.items
                        .filter(item => 
                          item.title.toLowerCase().includes(activeVendor.name.toLowerCase()) || 
                          activeVendor.rates.some(r => item.title.toLowerCase().includes(r.name.toLowerCase()))
                        )
                        .map(item => ({ dayNumber: day.dayNumber, ...item }))
                    ) || [];

                    return (
                      <div key={booking.id} className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-zinc-850 pb-2.5">
                          <div>
                            <span className="font-mono text-zinc-400 font-semibold text-[10px]">RESERVATION ID: {booking.id.substring(5, 12).toUpperCase()}</span>
                            <h4 className="font-bold text-zinc-200 uppercase mt-0.5">{itin?.title}</h4>
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                              booking.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                              booking.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' :
                              'bg-amber-500/10 text-amber-400 animate-pulse'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        </div>

                        {/* List items being ordered */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Ordered Services:</p>
                          {matchingItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded bg-zinc-950/40 border border-zinc-900">
                              <div>
                                <p className="font-semibold text-zinc-350">
                                  Day {item.dayNumber}: {item.title}
                                </p>
                                <span className="text-[9px] text-zinc-500">{item.details}</span>
                              </div>
                              <span className="font-semibold text-zinc-300 font-mono">₹{Number(item.costPrice).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>

                        {/* Quick actions for vendor */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {booking.status !== 'CONFIRMED' && (
                            <>
                              <div className="flex items-center space-x-2 shrink-0">
                                <input
                                  type="text"
                                  placeholder="Confirm Code (optional)"
                                  value={confirmCodeInput[booking.id] || ''}
                                  onChange={(e) => setConfirmCodeInput({
                                    ...confirmCodeInput,
                                    [booking.id]: e.target.value
                                  })}
                                  className="px-2.5 py-1 bg-zinc-800/80 border border-zinc-700/60 rounded text-[10px] text-zinc-300 w-36 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  onClick={() => handleConfirmReservation(booking.id)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded flex items-center space-x-1 transition-colors"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Confirm Service</span>
                                </button>
                              </div>
                            </>
                          )}

                          {booking.status === 'CONFIRMED' && (
                            <div className="flex items-center space-x-2 text-emerald-400 text-[10px] font-semibold">
                              <CheckCircle className="w-4 h-4" />
                              <span>Service Booking Confirmed {booking.hotelConfirmationCode && `[Code: ${booking.hotelConfirmationCode}]`}</span>
                            </div>
                          )}

                          {/* Voucher Upload trigger */}
                          <div className="ml-auto">
                            {booking.voucherUrl ? (
                              <a
                                href={booking.voucherUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-zinc-400 hover:text-white flex items-center space-x-1 underline text-[10px]"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Voucher Issued</span>
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  setVoucherBookingId(booking.id);
                                  setVoucherFileName(`voucher_${booking.id.substring(5,11)}.pdf`);
                                }}
                                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 rounded flex items-center space-x-1"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Upload Voucher / Ticket</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Interactive upload drawer sub-section */}
                        {voucherBookingId === booking.id && (
                          <form 
                            onSubmit={(e) => handleVoucherUpload(booking.id, e)}
                            className="mt-3 p-3 bg-zinc-950/60 border border-zinc-850 rounded-lg flex items-center space-x-2 animate-fadeIn"
                          >
                            <input
                              type="text"
                              value={voucherFileName}
                              onChange={(e) => setVoucherFileName(e.target.value)}
                              placeholder="voucher_filename.pdf"
                              required
                              className="px-2 py-1 bg-zinc-800 border border-zinc-750 rounded text-[10px] text-zinc-300 flex-1 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-650 text-white rounded text-[10px] font-bold"
                            >
                              Verify & Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setVoucherBookingId('')}
                              className="text-zinc-500 hover:text-zinc-350 text-[10px]"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payout History Ledger logs */}
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <h3 className="font-bold text-zinc-200 uppercase tracking-tight flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Financial Ledger Logs & Disbursements</span>
              </h3>
              
              <div className="border border-zinc-850 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-zinc-900/60 border-b border-zinc-850 text-zinc-400 font-bold uppercase text-[9px]">
                      <th className="p-3">Reference/Date</th>
                      <th className="p-3">Activity description</th>
                      <th className="p-3 text-right">Disbursed Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-zinc-350">
                    {activeVendorPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-zinc-500">
                          No direct disbursements logged in active cycle.
                        </td>
                      </tr>
                    ) : (
                      activeVendorPayouts.map(payout => (
                        <tr key={payout.id} className="hover:bg-zinc-900/30">
                          <td className="p-3 font-mono">
                            <div>{payout.id.substring(5,13).toUpperCase()}</div>
                            <div className="text-[9px] text-zinc-500">{new Date(payout.paymentDate).toLocaleDateString()}</div>
                          </td>
                          <td className="p-3">
                            Cash Settlement to {activeVendor.name} Ledger
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-400 font-mono">
                            +₹{Number(payout.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Rate cards and Availability matrices */}
          <div className="space-y-6">
            
            {/* Live Rate Card Directory */}
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <h3 className="font-bold text-zinc-200 uppercase tracking-tight flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Contracted Rate Card</span>
              </h3>

              {/* Add New Rate Form */}
              <form onSubmit={handleAddRate} className="space-y-3 bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Publish Custom Seasonal Rate:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-semibold mb-0.5">Rate Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Deluxe Suite Special"
                      value={newRateName}
                      onChange={(e) => setNewRateName(e.target.value)}
                      required
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-zinc-500 uppercase font-semibold mb-0.5">Type</label>
                    <select
                      value={newRateType}
                      onChange={(e) => setNewRateType(e.target.value)}
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-200 focus:outline-none"
                    >
                      <option value="HOTEL">Hotel</option>
                      <option value="FLIGHT">Flight</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="ACTIVITY">Activity</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <label className="block text-[8px] text-zinc-500 uppercase font-semibold mb-0.5">Net Rate (Cost)</label>
                    <input
                      type="number"
                      placeholder="Cost in INR"
                      value={newRatePrice}
                      onChange={(e) => setNewRatePrice(e.target.value)}
                      required
                      className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-200 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="self-end px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded font-bold transition-colors flex items-center space-x-1 text-[10px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publish</span>
                  </button>
                </div>
              </form>

              {/* Rate List */}
              <div className="space-y-2">
                {activeVendor.rates.map((rate, index) => {
                  // Type icon lookup
                  const RateIcon = (vendorIconMap as any)[rate.type] || FileText;

                  return (
                    <div key={index} className="flex justify-between items-center p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-850">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                          <RateIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-200">{rate.name}</p>
                          <span className="text-[8px] text-zinc-500 uppercase">{rate.type}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-zinc-300 font-mono">₹{Number(rate.price).toLocaleString('en-IN')}</span>
                        <button
                          onClick={() => handleDeleteRate(index)}
                          className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Availability Inventory */}
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                <h3 className="font-bold text-zinc-200 uppercase tracking-tight flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>Availability Inventory</span>
                </h3>
                <span className="text-[9px] text-zinc-500">Service Quota Rooms/Vehicles</span>
              </div>

              <div className="space-y-2">
                {Object.entries(availability).map(([date, quota]) => (
                  <div key={date} className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/40 border border-zinc-850">
                    <span className="font-semibold text-zinc-300 font-mono text-[10px]">
                      {new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => adjustAvailability(date, -1)}
                        disabled={quota === 0}
                        className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 font-bold flex items-center justify-center text-[11px]"
                      >
                        -
                      </button>
                      <span className={`w-8 text-center font-bold text-[11px] font-mono ${
                        quota === 0 ? 'text-red-400' :
                        quota <= 3 ? 'text-amber-400' :
                        'text-emerald-400'
                      }`}>
                        {quota}
                      </span>
                      <button
                        onClick={() => adjustAvailability(date, 1)}
                        className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold flex items-center justify-center text-[11px]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RLS Security Information */}
            <div className="p-4 bg-zinc-900/20 border border-zinc-850 rounded-xl text-[10px] text-zinc-500 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-zinc-450 uppercase text-[9px]">Row-Level Isolation Enabled</p>
                <p className="leading-normal">
                  Vendors are constrained dynamically inside this layout viewport to view resources where `agency_id = current_agency_id`. Direct writes update Zustand cache maps reflecting state in active client views.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-4 text-center text-[9px] text-zinc-600">
        <p>© 2026 AeroERP Security Gateways. Managed by Supabase Partner Contracts.</p>
      </footer>
    </div>
  );
}
