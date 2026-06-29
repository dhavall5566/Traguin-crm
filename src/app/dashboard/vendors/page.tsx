'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useVendorsPage } from '@/hooks/useVendorsPage';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { defaultCountryCode } from '@/data/country-codes';
import { formatFullPhone } from '@/lib/phone-input';
import {
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  X,
  CreditCard,
  Trash2,
  Save,
} from 'lucide-react';

export default function VendorsPage() {
  const currentAgency = useStore((state) => state.currentAgency);
  const {
    vendors,
    loading,
    backgroundLoading,
    error,
    dirtyIds,
    savingId,
    addVendor,
    updateVendorLocal,
    saveVendor,
    deleteVendor,
    recordVendorPayout,
    hydrateVendorDetail,
  } = useVendorsPage();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add form fields
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState<'SERVICE' | 'PACKAGE'>('SERVICE');
  const [vEmail, setVEmail] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vPhoneCountryCode, setVPhoneCountryCode] = useState(defaultCountryCode);
  const [vAddress, setVAddress] = useState('');

  // Rates add fields
  const [rateName, setRateName] = useState('');
  const [rateType, setRateType] = useState('HOTEL');
  const [ratePrice, setRatePrice] = useState('');

  const agencyVendors = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return vendors.filter(
      (v) =>
        v.agencyId === currentAgency.id &&
        (v.name + ' ' + v.type).toLowerCase().includes(q),
    );
  }, [vendors, currentAgency.id, debouncedSearch]);

  const vendorsPagination = useClientPagination(agencyVendors, undefined, [debouncedSearch]);

  React.useEffect(() => {
    if (loading) return;
    if (!selectedVendorId && agencyVendors.length > 0) {
      setSelectedVendorId(agencyVendors[0].id);
    }
  }, [agencyVendors, selectedVendorId, loading]);

  React.useEffect(() => {
    if (!selectedVendorId) return;
    void hydrateVendorDetail(selectedVendorId);
  }, [selectedVendorId, hydrateVendorDetail]);

  const activeVendor =
    vendors.find((v) => v.id === selectedVendorId && v.agencyId === currentAgency.id) ??
    agencyVendors.find((v) => v.id === selectedVendorId);
  const activeVendorDirty = activeVendor ? dirtyIds.has(activeVendor.id) : false;

  const handleRegisterVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const created = await addVendor({
        name: vName,
        type: vType,
        email: vEmail,
        phone: formatFullPhone(vPhoneCountryCode, vPhone),
        address: vAddress,
        rates: [{ name: 'Standard Room Rate', type: 'HOTEL', price: 6500 }],
      });
      setVName('');
      setVEmail('');
      setVPhone('');
      setVPhoneCountryCode(defaultCountryCode);
      setVAddress('');
      setShowAddModal(false);
      setSelectedVendorId(created.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to register vendor');
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVendor || !payoutAmount) return;
    setPayoutError(null);
    try {
      await recordVendorPayout(activeVendor.id, Number(payoutAmount));
      setPayoutAmount('');
      alert(`Payout of ₹${payoutAmount} registered. Vendor balance updated.`);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to record payout');
    }
  };

  const handleAddRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVendor || !rateName.trim() || !ratePrice) return;

    const updatedRates = [
      ...(activeVendor.rates || []),
      { name: rateName, type: rateType, price: Number(ratePrice) },
    ];
    updateVendorLocal(activeVendor.id, { rates: updatedRates });
    setRateName('');
    setRatePrice('');
  };

  const handleRemoveRate = (index: number) => {
    if (!activeVendor) return;
    const updatedRates = (activeVendor.rates || []).filter((_, i) => i !== index);
    updateVendorLocal(activeVendor.id, { rates: updatedRates });
  };

  const handleSaveRates = async () => {
    if (!activeVendor) return;
    setActionError(null);
    try {
      await saveVendor(activeVendor.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save rate schedules');
    }
  };

  const handleDeleteVendor = async () => {
    if (!activeVendor) return;
    if (!window.confirm(`Remove vendor "${activeVendor.name}"? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      await deleteVendor(activeVendor.id);
      setSelectedVendorId('');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete vendor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">
            Vendor accounts & rates
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor service provider rate registries, track outstanding vendor payouts, and maintain ledgers.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/10 self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Register Vendor</span>
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {actionError}
        </div>
      ) : null}

      {/* Search */}
      <div className="crm-filter-bar text-xs">
        <div className="crm-filter-bar__search">
          <Search className="crm-filter-bar__search-icon" />
          <input
            type="text"
            placeholder="Filter vendors by name or service category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="crm-filter-bar__input"
          />
        </div>
      </div>

      {/* Grid workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs items-start">
        {/* Left Side: Table of vendors */}
        <div className="lg:col-span-2">
          <CrmTablePanel>
          <p className="crm-table-panel__title">Registered Partners Directory</p>
          <div className="crm-table-wrap">
          <div className="overflow-x-auto">
            <table className="crm-data-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Service Type</th>
                  <th>Email</th>
                  <th className="text-right">Owed Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-3">
                      <CrmTableSkeleton columns={4} rows={8} />
                    </td>
                  </tr>
                ) : vendorsPagination.pageItems.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => {
                      setDeleteError(null);
                      setSelectedVendorId(vendor.id);
                    }}
                    className={`cursor-pointer ${selectedVendorId === vendor.id ? 'crm-data-table__row--selected' : ''}`}
                  >
                    <td className="font-semibold">
                      <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {vendor.name.charAt(0)}
                      </div>
                      <span>{vendor.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="crm-table-badge">{vendor.type}</span>
                    </td>
                    <td className="text-muted-foreground">{vendor.email || 'None'}</td>
                    <td className="text-right font-bold text-amber-500">
                      ₹{Number(vendor.ledgerBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {!loading && agencyVendors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="crm-data-table__empty">
                      No vendors match this query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!loading ? (
            <CrmTablePagination
              label="Vendors"
              rangeStart={vendorsPagination.rangeStart}
              rangeEnd={vendorsPagination.rangeEnd}
              total={vendorsPagination.total}
              page={vendorsPagination.page}
              totalPages={vendorsPagination.totalPages}
              hasPrev={vendorsPagination.hasPrev}
              hasNext={vendorsPagination.hasNext}
              onPrev={vendorsPagination.goPrev}
              onNext={vendorsPagination.goNext}
              backgroundLoading={backgroundLoading}
            />
          ) : null}
          </div>
          </CrmTablePanel>
        </div>

        {/* Right Side: Ledger & Rate card details */}
        <div className="space-y-6">
          {activeVendor ? (
            <div className="p-5 bg-card border border-border rounded-xl space-y-6 animate-scale-in">
              <div className="border-b border-border pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-wider">
                      Partner Profile Details
                    </span>
                    <h3 className="text-sm font-bold mt-1 text-foreground">{activeVendor.name}</h3>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                      {activeVendor.type} Vendor Account
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteVendor}
                    title="Remove vendor"
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {deleteError ? (
                  <p className="mt-2 crm-alert-warning text-[10px] font-medium">
                    {deleteError}
                  </p>
                ) : null}
              </div>

              {/* Vendor details */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{activeVendor.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{activeVendor.phone || 'No phone registered'}</span>
                </div>
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{activeVendor.address || 'No address registered'}</span>
                </div>
              </div>

              {/* Ledger Outstanding Balance Payouts */}
              <div className="p-4 rounded-xl bg-secondary/35 border border-border/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[9px] text-muted-foreground uppercase tracking-wider">
                    Ledger Account Balance
                  </span>
                  <span className="font-bold text-amber-500">
                    ₹{Number(activeVendor.ledgerBalance).toLocaleString('en-IN')} Owed
                  </span>
                </div>

                <form onSubmit={handlePayoutSubmit} className="flex gap-2">
                  <input
                    type="number"
                    required
                    placeholder="Disburse Amount (₹)"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded bg-card border border-border focus:outline-none text-[11px]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center space-x-1 shrink-0"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Disburse Payout</span>
                  </button>
                </form>
                {payoutError ? (
                  <p className="text-[10px] text-destructive">{payoutError}</p>
                ) : null}
              </div>

              {/* Rates registry */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-[9px] text-muted-foreground uppercase tracking-wider">
                    Contract Rate Schedules
                  </h4>
                  <button
                    type="button"
                    onClick={handleSaveRates}
                    disabled={!activeVendorDirty || savingId === activeVendor.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {savingId === activeVendor.id ? 'Saving…' : activeVendorDirty ? 'Save schedules' : 'Saved'}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeVendor.rates?.map((rate, idx) => (
                    <div key={`${rate.name}-${idx}`} className="flex justify-between items-center p-2 rounded bg-secondary/20 border border-border/30">
                      <div>
                        <p className="font-semibold text-foreground">{rate.name}</p>
                        <span className="text-[8px] text-muted-foreground uppercase font-bold">{rate.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-500">₹{Number(rate.price).toLocaleString('en-IN')}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRate(idx)}
                          className="text-[9px] text-destructive underline underline-offset-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {(activeVendor.rates?.length ?? 0) === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No rate schedules yet.</p>
                  )}
                </div>

                {/* Add new rate form */}
                <form onSubmit={handleAddRate} className="p-3 bg-secondary/20 border border-border/60 rounded-lg space-y-2">
                  <span className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                    Register New Rate Card
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={rateType}
                      onChange={(e) => setRateType(e.target.value)}
                      className="px-2 py-1 bg-card border border-border rounded text-[10px] focus:outline-none"
                    >
                      <option value="HOTEL">Hotel stay</option>
                      <option value="FLIGHT">Flight Seat</option>
                      <option value="VEHICLE">Transfer Car</option>
                      <option value="ACTIVITY">Excursion</option>
                    </select>
                    <input
                      type="number"
                      required
                      placeholder="Price (₹)"
                      value={ratePrice}
                      onChange={(e) => setRatePrice(e.target.value)}
                      className="px-2 py-1 bg-card border border-border rounded text-[10px] focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deluxe Room Season-High"
                    value={rateName}
                    onChange={(e) => setRateName(e.target.value)}
                    className="w-full px-2 py-1 bg-card border border-border rounded text-[10px] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[9px]"
                  >
                    Log Rate Schedule
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-muted-foreground border border-dashed border-border rounded-xl">
              {loading
                ? 'Loading vendor profiles…'
                : 'Select a vendor profile to inspect ledger rates and accounts.'}
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">Register Service Vendor</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterVendor} className="space-y-4">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Vendor Name
                </label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Dal View Retreat Srinagar"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Vendor Type
                </label>
                <select
                  value={vType}
                  onChange={(e) => setVType(e.target.value as 'SERVICE' | 'PACKAGE')}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                >
                  <option value="SERVICE">Service Vendor (Individual Flights, Hotels, Guides)</option>
                  <option value="PACKAGE">Package Vendor (Total fixed package tours)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  placeholder="reservations@hotel.com"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Phone
                </label>
                <PhoneInput
                  id="vendor-phone"
                  variant="crm"
                  countryCode={vPhoneCountryCode}
                  onCountryCodeChange={setVPhoneCountryCode}
                  value={vPhone}
                  onChange={setVPhone}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Physical HQ Address
                </label>
                <input
                  type="text"
                  value={vAddress}
                  onChange={(e) => setVAddress(e.target.value)}
                  placeholder="Boulevard Road, Srinagar"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Add Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
