'use client';

import React, { useState, useEffect } from 'react';
import { useStore, Customer } from '@/lib/store';
import { useCustomersPage } from '@/hooks/useCustomersPage';
import { isEmailConflictError } from '@/lib/api/customers';
import { 
  Users,
  Plus,
  Search,
  FileText,
  Upload,
  History,
  X,
  Trash2,
  Link as LinkIcon,
  AlertCircle
} from 'lucide-react';

export default function CustomersPage() {
  const { currentAgency } = useStore();
  const {
    customers,
    loading,
    error: loadError,
    addCustomer,
    updateCustomer,
    uploadCustomerDoc,
    deleteCustomer,
  } = useCustomersPage();

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');

  // Upload fields
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('Passport');
  const [docUploaded, setDocUploaded] = useState(false);

  const agencyCustomers = customers.filter(
    (c) =>
      c.agencyId === currentAgency.id &&
      (c.firstName + ' ' + c.lastName + ' ' + c.email)
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  const isEmptyAgency = !loading && !loadError && customers.length === 0;
  const hasSearchFilter = search.trim().length > 0;

  useEffect(() => {
    if (!selectedCustomer) return;
    const fresh = customers.find((c) => c.id === selectedCustomer.id);
    if (fresh) setSelectedCustomer(fresh);
    else setSelectedCustomer(null);
  }, [customers, selectedCustomer?.id]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassportNumber('');
    setPassportExpiry('');
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (cust: Customer) => {
    setFirstName(cust.firstName);
    setLastName(cust.lastName);
    setEmail(cust.email);
    setPhone(cust.phone ?? '');
    setPassportNumber(cust.passportNumber ?? '');
    setPassportExpiry(cust.passportExpiry ?? '');
    setFormError(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setSaving(true);
      setFormError(null);
      try {
        if (modalMode === 'create') {
          const created = await addCustomer({
            firstName,
            lastName,
            email,
            phone,
            passportNumber: passportNumber || undefined,
            passportExpiry: passportExpiry || undefined,
          });
          setSelectedCustomer(created);
        } else if (selectedCustomer) {
          const updated = await updateCustomer(selectedCustomer.id, {
            firstName,
            lastName,
            email,
            phone,
            passportNumber: passportNumber || undefined,
            passportExpiry: passportExpiry || undefined,
          });
          setSelectedCustomer(updated);
        }
        resetForm();
        setShowModal(false);
      } catch (err) {
        if (isEmailConflictError(err)) {
          setFormError('A customer with this email already exists in your agency. Use a different email or edit the existing profile.');
        } else {
          setFormError(err instanceof Error ? err.message : 'Could not save customer');
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !docName.trim()) return;

    void (async () => {
      try {
        const updated = await uploadCustomerDoc(selectedCustomer.id, {
          name: docName,
          category: docCategory,
          size: `${(1 + Math.random() * 2).toFixed(1)} MB`,
        });
        setSelectedCustomer(updated);
        setDocName('');
        setDocUploaded(true);
        setTimeout(() => setDocUploaded(false), 2000);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Upload failed');
      }
    })();
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    if (!window.confirm(`Remove ${selectedCustomer.firstName} ${selectedCustomer.lastName} from the active directory?`)) return;
    void (async () => {
      try {
        await deleteCustomer(selectedCustomer.id);
        setSelectedCustomer(null);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Delete failed');
      }
    })();
  };

  const isPassportExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate).getTime() < new Date().getTime();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="crm-page-title">
            Customer Database Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage profiles, record passport records, upload visas, and view booking histories.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/10 self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
          Loading customer directory…
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-300">
          Could not load customers: {loadError}
        </div>
      )}

      {isEmptyAgency && (
        <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/15 px-6 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No customers yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your directory is empty. Add customer profiles here, or they will appear when leads are converted and linked.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add your first customer
          </button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="relative text-xs">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filter customers by name or email address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
        />
      </div>

      {/* Customers Table / Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Customers list table */}
        <div className="lg:col-span-2 p-5 bg-card border border-border rounded-xl space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Customer Registry</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase font-bold">
                  <th className="pb-2">Customer Profile</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Phone</th>
                  <th className="pb-2">Passport No.</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {agencyCustomers.map((cust) => {
                  const expired = isPassportExpired(cust.passportExpiry);
                  
                  return (
                    <tr 
                      key={cust.id} 
                      onClick={() => setSelectedCustomer(cust)}
                      className={`hover:bg-secondary/20 cursor-pointer ${selectedCustomer?.id === cust.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-3 font-semibold text-foreground flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {cust.firstName.charAt(0)}{cust.lastName.charAt(0)}
                        </div>
                        <span>{cust.firstName} {cust.lastName}</span>
                      </td>
                      <td className="py-3 text-muted-foreground">{cust.email}</td>
                      <td className="py-3 text-muted-foreground">{cust.phone || 'None'}</td>
                      <td className="py-3 font-mono">
                        {cust.passportNumber ? (
                          <span className={`inline-flex items-center space-x-1 ${expired ? 'text-red-400 font-bold' : ''}`}>
                            <span>{cust.passportNumber}</span>
                            {expired && (
                              <span title="Passport Expired" className="inline-flex shrink-0">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 italic">Not set</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(cust);
                          }}
                          className="text-[10px] text-primary font-semibold hover:underline"
                        >
                          Manage Documents
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {agencyCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      {isEmptyAgency
                        ? 'No customer profiles yet.'
                        : hasSearchFilter
                          ? 'No customer profiles match this search query.'
                          : 'No customer profiles to show.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Documents & Details Panel */}
        <div className="p-5 bg-card border border-border rounded-xl space-y-6">
          {selectedCustomer ? (
            <div className="space-y-6 text-xs animate-scale-in">
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    {selectedCustomer.firstName.charAt(0)}{selectedCustomer.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                    <span className="text-[10px] text-muted-foreground">{selectedCustomer.email}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-1 rounded hover:bg-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedCustomer)}
                  className="flex-1 py-1.5 rounded-lg border border-border bg-secondary/40 text-[10px] font-semibold hover:bg-secondary"
                >
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCustomer}
                  className="py-1.5 px-3 rounded-lg border border-red-900/40 bg-red-950/20 text-red-400 text-[10px] font-semibold hover:bg-red-950/40 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>

              {/* Passport details */}
              <div className="space-y-2">
                <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  Passport Information
                </span>
                <div className="p-3 bg-secondary/30 border border-border/40 rounded-xl grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Passport No:</span>
                    <p className="font-semibold font-mono">{selectedCustomer.passportNumber || 'Not set'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Expiry Date:</span>
                    <p className={`font-semibold ${isPassportExpired(selectedCustomer.passportExpiry) ? 'text-red-400 font-bold' : ''}`}>
                      {selectedCustomer.passportExpiry || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Travel history */}
              <div className="space-y-2">
                <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center space-x-1.5">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Historical Travel History</span>
                </span>
                <div className="space-y-1">
                  {selectedCustomer.travelHistory.map((hist, idx) => (
                    <div key={idx} className="p-2 rounded bg-secondary/50 border border-border/30">
                      {hist}
                    </div>
                  ))}
                  {selectedCustomer.travelHistory.length === 0 && (
                    <span className="text-muted-foreground/60 italic">
                      No travel history logged. Booking history will appear here once Bookings are wired to the API.
                    </span>
                  )}
                </div>
              </div>

              {/* Documents lists */}
              <div className="space-y-2">
                <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  Uploaded Document Scans
                </span>
                <div className="space-y-2">
                  {selectedCustomer.documents.map((doc, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/20 border border-border/40">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[130px]">{doc.name}</p>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">{doc.category} ({doc.size})</span>
                        </div>
                      </div>
                      <a href="#" className="p-1 hover:bg-secondary rounded text-primary text-[10px] font-bold flex items-center space-x-1">
                        <LinkIcon className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                  {selectedCustomer.documents.length === 0 && (
                    <span className="text-muted-foreground/60 italic">No documents uploaded.</span>
                  )}
                </div>
              </div>

              {/* Upload Form — metadata only (no real file storage yet) */}
              <form onSubmit={handleUploadSubmit} className="p-3 bg-secondary/35 border border-border rounded-lg space-y-3">
                <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  Simulate Document Upload
                </span>
                <p className="text-[9px] text-muted-foreground/80 leading-relaxed">
                  Stores filename metadata in the customer record (url remains placeholder). Real file storage is not wired yet.
                </p>
                
                {docUploaded && (
                  <div className="p-2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold text-center border border-emerald-500/20">
                    File uploaded & RLS encrypted successfully!
                  </div>
                )}

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="px-2 py-1 bg-card border border-border rounded text-[11px] focus:outline-none"
                    >
                      <option value="Passport">Passport Copy</option>
                      <option value="Visa">Visa Letter</option>
                      <option value="Flight Ticket">Flight Ticket</option>
                      <option value="Hotel Voucher">Hotel Voucher</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="e.g. kashmir_permit.pdf"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      className="px-2 py-1 bg-card border border-border rounded text-[11px] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[10px] flex items-center justify-center space-x-1 shadow shadow-indigo-600/10"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-2 text-muted-foreground">
              <Users className="w-8 h-8 text-muted-foreground/40" />
              <p>Select a customer profile to view documents, passports, and upload files.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">
                {modalMode === 'create' ? 'Register Customer Profile' : 'Edit Customer Profile'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/40 text-red-200 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Aarav"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Mehta"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Passport No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    placeholder="N8765432"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Passport Expiration
                  </label>
                  <input
                    type="date"
                    value={passportExpiry}
                    onChange={(e) => setPassportExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold"
                >
                  {saving ? 'Saving…' : modalMode === 'create' ? 'Create Profile' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
