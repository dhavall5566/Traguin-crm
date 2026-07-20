'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useLeadsPage } from '@/hooks/useLeadsPage';
import { useCustomersPage } from '@/hooks/useCustomersPage';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { defaultCountryCode } from '@/data/country-codes';
import { formatFullPhone, parsePhoneNumber } from '@/lib/phone-input';
import { LeadIntakeAlerts } from '@/components/crm/LeadIntakeAlerts';
import { checkLeadIntake, type LeadIntakeCheckResult } from '@/lib/api/leads';
import { formatLeadDisplayCode, leadCodeLegendHint, buildActiveLegendEntries } from '@/lib/lead-codes';
import { LeadIdLegend } from '@/components/crm/LeadIdLegend';
import { crmToastError, crmToastInfo, crmToastSuccess } from '@/lib/crm-toast-bus';
import { STORAGE_CREATE_ITIN_FROM_CRM, readCrmBookingResumeFromStorage } from '@/lib/crmItineraryHandoff';
import { useNavigateToLeadDetail } from '@/hooks/useNavigateToLeadDetail';
import {
  Plus,
  Search,
  RefreshCw,
  X,
  UserPlus,
  Users,
} from 'lucide-react';

import {
  LEAD_PIPELINE_STAGES,
  isLostPipelineStatus,
  isWonPipelineStatus,
  leadMatchesStage,
  pipelineStageBarClass,
  pipelineStageName,
  pipelineStageTopClass,
  resolvePipelineStage,
  type LeadPipelineStatus,
} from '@/lib/lead-pipeline';
const stages = LEAD_PIPELINE_STAGES;

type LeadViewMode = 'kanban' | 'tiles' | 'list';

const LEAD_VIEW_OPTIONS: { value: LeadViewMode; label: string }[] = [
  { value: 'kanban', label: 'Kanban' },
  { value: 'tiles', label: 'Pipeline' },
  { value: 'list', label: 'Table' },
];

type StatsPeriod = 'today' | '7d' | '30d' | 'all';

const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

function leadCreatedWithinPeriod(createdAt: string, period: StatsPeriod): boolean {
  if (period === 'all') return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'today') {
    return new Date(createdAt).getTime() >= start.getTime();
  }
  const days = period === '7d' ? 7 : 30;
  start.setDate(start.getDate() - days);
  return new Date(createdAt).getTime() >= start.getTime();
}

export default function CRMPage() {
  const navigateToLead = useNavigateToLeadDetail();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    leads,
    staff,
    loading: leadsLoading,
    backgroundLoading: leadsBackgroundLoading,
    error: leadsError,
    refreshLeads,
    addLead,
    updateLeadStatus,
    updateLeadExtras,
  } = useLeadsPage();

  const { customers } = useCustomersPage();

  const { currentAgency } = useStore();

  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const creatingLeadRef = useRef(false);

  const runLeadAction = async (
    label: string,
    fn: () => Promise<void>,
    successMessage?: string,
  ) => {
    setActionError(null);
    try {
      await fn();
      crmToastSuccess(successMessage ?? `${label} completed`);
    } catch (e) {
      const message = e instanceof Error ? e.message : `${label} failed`;
      setActionError(message);
      crmToastError(message);
    }
  };
  // Search & Filter state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filterAgent, setFilterAgent] = useState('ALL');
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('30d');
  const [refreshingLeads, setRefreshingLeads] = useState(false);
  type SortBy = 'value' | 'date';
  const [sortBy, setSortBy] = useState<SortBy>('date');

  /** Board, responsive tiles, or table */
  const [leadView, setLeadView] = useState<LeadViewMode>('list');

  const [showAddModal, setShowAddModal] = useState(false);

  /** Legacy deep links: `/dashboard/crm?openLead=<id>` navigates to lead detail. */
  const openLeadHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('openLead')?.trim();
    if (!raw) return;
    if (openLeadHandledRef.current === raw) return;
    const leadExists = leads.some((l) => l.id === raw && l.agencyId === currentAgency.id);
    if (!leadExists) return;
    openLeadHandledRef.current = raw;
    navigateToLead(raw);
  }, [searchParams, leads, currentAgency.id, navigateToLead]);

  /** Trip planner → CRM: navigate to lead detail with booking resume payload (once). */
  const bookingResumeHandledRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (pathname !== '/dashboard/crm') return;
    if (typeof window === 'undefined') return;

    const resume = readCrmBookingResumeFromStorage();
    if (!resume) return;

    const handleKey = `${resume.leadId}:${resume.itineraryId}`;
    if (bookingResumeHandledRef.current === handleKey) return;
    bookingResumeHandledRef.current = handleKey;

    const { leadId: lid, itineraryId: iid } = resume;

    const resumeLeadSnap = leads.find(
      (l) => l.id === lid && l.agencyId === currentAgency.id,
    );
    if (
      resumeLeadSnap &&
      ((resumeLeadSnap.proposalItineraryId ?? '').trim() || '') !== iid
    ) {
      updateLeadExtras(lid, { proposalItineraryId: iid });
    }

    navigateToLead(lid);
  }, [pathname, leads, currentAgency.id, updateLeadExtras, navigateToLead]);

  // New Lead Form state
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneCountryCode, setNewPhoneCountryCode] = useState(defaultCountryCode);
  const [newValue, setNewValue] = useState('');
  const [newSource, setNewSource] = useState('Website');
  const [newAssigned, setNewAssigned] = useState('');
  const [leadEntryMode, setLeadEntryMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [addIntakeCheck, setAddIntakeCheck] = useState<LeadIntakeCheckResult | null>(null);
  const [addIntakeCheckLoading, setAddIntakeCheckLoading] = useState(false);
  const debouncedNewEmail = useDebouncedValue(newEmail, 400);
  const debouncedNewPhone = useDebouncedValue(
    formatFullPhone(newPhoneCountryCode, newPhone),
    400,
  );

  const agencyCustomers = useMemo(
    () => customers.filter((c) => c.agencyId === currentAgency.id),
    [customers, currentAgency.id]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return agencyCustomers;
    return agencyCustomers.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ''}`.toLowerCase().includes(q)
    );
  }, [agencyCustomers, customerSearch]);

  const selectedCustomer = agencyCustomers.find((c) => c.id === selectedCustomerId);

  const resolvePreviousAgentId = (customerId: string) => {
    const customer = agencyCustomers.find((c) => c.id === customerId);
    if (!customer) return '';

    const activeStaffIds = new Set(staff.map((u) => u.id));

    const firstHandledLead = leads
      .filter((l) => l.agencyId === currentAgency.id && l.assignedToId)
      .filter(
        (l) =>
          l.customerId === customerId ||
          (customer.email && l.email?.toLowerCase() === customer.email.toLowerCase()) ||
          (l.firstName === customer.firstName && l.lastName === customer.lastName)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .find((l) => l.assignedToId && activeStaffIds.has(l.assignedToId));

    return firstHandledLead?.assignedToId ?? '';
  };

  const resetLeadForm = () => {
    try {
      // Drop any unfinished "create itinerary from CRM" payload so saving a brand-new lead can't
      // later pair with stale session when Trip planner mounts (or its effect runs again).
      sessionStorage.removeItem(STORAGE_CREATE_ITIN_FROM_CRM);
    } catch {
      /* quota / blocked */
    }
    setNewTitle('');
    setNewMessage('');
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
    setNewPhoneCountryCode(defaultCountryCode);
    setNewValue('');
    setNewSource('Website');
    setNewAssigned('');
    setLeadEntryMode('new');
    setSelectedCustomerId('');
    setCustomerSearch('');
    setAddIntakeCheck(null);
    setAddIntakeCheckLoading(false);
  };

  useEffect(() => {
    if (!showAddModal) {
      setAddIntakeCheck(null);
      setAddIntakeCheckLoading(false);
      return;
    }
    const email = debouncedNewEmail.trim();
    const phone = debouncedNewPhone.trim();
    if (!email && !phone) {
      setAddIntakeCheck(null);
      setAddIntakeCheckLoading(false);
      return;
    }

    let cancelled = false;
    setAddIntakeCheckLoading(true);
    void checkLeadIntake({ email: email || undefined, phone: phone || undefined })
      .then((result) => {
        if (!cancelled) setAddIntakeCheck(result);
      })
      .catch(() => {
        if (!cancelled) setAddIntakeCheck(null);
      })
      .finally(() => {
        if (!cancelled) setAddIntakeCheckLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showAddModal, debouncedNewEmail, debouncedNewPhone]);

  useEffect(() => {
    if (!showAddModal || leadEntryMode !== 'new') return;
    tryMatchCustomerByPhone(debouncedNewPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match when debounced phone settles
  }, [showAddModal, leadEntryMode, debouncedNewPhone]);

  const openAddLeadModal = () => {
    resetLeadForm();
    setShowAddModal(true);
  };

  const applyCustomerToForm = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setCustomerSearch('');
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewPhoneCountryCode(defaultCountryCode);
      setNewAssigned('');
      return;
    }
    const customer = agencyCustomers.find((c) => c.id === customerId);
    if (!customer) return;
    setNewFirstName(customer.firstName);
    setNewLastName(customer.lastName);
    setNewEmail(customer.email);
    const parsedPhone = parsePhoneNumber(customer.phone);
    setNewPhoneCountryCode(parsedPhone.countryCode);
    setNewPhone(parsedPhone.localNumber);
    setNewAssigned(resolvePreviousAgentId(customerId));
  };

  const handleEntryModeChange = (mode: 'new' | 'existing') => {
    setLeadEntryMode(mode);
    setSelectedCustomerId('');
    setCustomerSearch('');
    setNewAssigned('');
    if (mode === 'new') {
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewPhoneCountryCode(defaultCountryCode);
    }
  };

  const tryMatchCustomerByEmail = (email: string) => {
    if (leadEntryMode !== 'new' || !email.trim()) return;
    const match = agencyCustomers.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (match) {
      setLeadEntryMode('existing');
      applyCustomerToForm(match.id);
    }
  };

  const tryMatchCustomerByPhone = (phone: string) => {
    if (leadEntryMode !== 'new' || !phone.trim()) return;
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length < 10) return;
    const match = agencyCustomers.find((c) => {
      const customerDigits = (c.phone ?? '').replace(/\D/g, '').slice(-10);
      return customerDigits.length >= 10 && customerDigits === digits;
    });
    if (match) {
      setLeadEntryMode('existing');
      applyCustomerToForm(match.id);
    }
  };

  const agencyLeads = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return leads
      .filter((l) => l.agencyId === currentAgency.id)
      .filter((l) => leadCreatedWithinPeriod(l.createdAt, statsPeriod))
      .filter((l) => {
        const matchSearch = (l.title + ' ' + l.firstName + ' ' + l.lastName)
          .toLowerCase()
          .includes(q);
        const matchAgent = filterAgent === 'ALL' || l.assignedToId === filterAgent;
        return matchSearch && matchAgent;
      })
      .sort((a, b) => {
        if (sortBy === 'value') {
          return Number(b.value) - Number(a.value);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [leads, currentAgency.id, debouncedSearch, filterAgent, sortBy, statsPeriod]);

  const leadAbbrevLegendEntries = useMemo(() => {
    const agencyOnly = leads.filter((l) => l.agencyId === currentAgency.id);
    return buildActiveLegendEntries(agencyOnly);
  }, [leads, currentAgency.id]);

  // Get staff for dropdown list (loaded from CRM API)
  const previousAgentName = staff.find((u) => u.id === newAssigned)?.name;

  const hasActiveFilters =
    search.trim() !== '' || filterAgent !== 'ALL' || statsPeriod !== 'all';
  const isEmptyAgency = !leadsLoading && !leadsError && leads.length === 0;

  const leadsTablePagination = useClientPagination(agencyLeads, undefined, [
    debouncedSearch,
    filterAgent,
    sortBy,
    leadView,
    statsPeriod,
  ]);

  const leadStats = useMemo(() => {
    const agency = leads.filter(
      (l) =>
        l.agencyId === currentAgency.id &&
        leadCreatedWithinPeriod(l.createdAt, statsPeriod),
    );
    const newCount = agency.filter((l) => l.status === 'NEW').length;
    const wonCount = agency.filter((l) => isWonPipelineStatus(l.status)).length;
    const lostCount = agency.filter((l) => isLostPipelineStatus(l.status)).length;
    const totalClosed = agency
      .filter((l) => isWonPipelineStatus(l.status))
      .reduce((sum, l) => sum + Number(l.value), 0);
    const conversionRate = agency.length ? (wonCount / agency.length) * 100 : 0;
    return {
      newCount,
      wonCount,
      lostCount,
      totalClosed,
      conversionRate,
      total: agency.length,
    };
  }, [leads, currentAgency.id, statsPeriod]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingLeadRef.current) return;
    if (leadEntryMode === 'existing' && !selectedCustomerId) return;
    creatingLeadRef.current = true;

    void runLeadAction('Create lead', async () => {
      setCreatingLead(true);
      try {
        const result = await addLead({
          title: newTitle,
          firstName: newFirstName,
          lastName: newLastName,
          email: newEmail || undefined,
          phone: formatFullPhone(newPhoneCountryCode, newPhone) || undefined,
          status: 'NEW',
          value: Number(newValue) || 0,
          source: newSource,
          assignedToId: newAssigned || undefined,
          customerId: selectedCustomerId || undefined,
          message: newMessage.trim() || undefined,
        });
        if (!result) return;

        resetLeadForm();
        setShowAddModal(false);
        if (result.merged) {
          crmToastInfo('Inquiry merged into existing lead (duplicate phone or email detected).');
          navigateToLead(result.lead.id);
        }
      } finally {
        creatingLeadRef.current = false;
        setCreatingLead(false);
      }
    }, 'Lead saved');
  };

  const handleStatusChange = (leadId: string, status: LeadPipelineStatus) => {
    void runLeadAction('Update status', async () => {
      await updateLeadStatus(leadId, status);
    }, 'Status updated');
  };

  const handleRefreshLeads = () => {
    if (refreshingLeads || leadsLoading) return;
    void (async () => {
      setRefreshingLeads(true);
      try {
        await refreshLeads();
      } finally {
        setRefreshingLeads(false);
      }
    })();
  };

  return (
    <>
    <div className="space-y-5">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-header__title">Leads</h1>
          <p className="crm-page-header__meta">
            {leadStats.total} lead{leadStats.total === 1 ? '' : 's'} · {STATS_PERIOD_LABELS[statsPeriod]}
            {leadsBackgroundLoading ? ' · Syncing…' : ''}
          </p>
        </div>
        <div className="crm-page-actions">
          <button type="button" onClick={openAddLeadModal} className="crm-btn-primary">
            <Plus className="w-4 h-4" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {leadsLoading && isEmptyAgency && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
          Loading leads from your workspace…
        </div>
      )}

      {leadsError && !leadsLoading && (
        <div className="crm-alert-error text-xs flex flex-wrap items-center justify-between gap-2">
          <span>Could not load leads: {leadsError}</span>
          <button
            type="button"
            className="crm-btn-secondary text-[11px] px-2.5 py-1"
            onClick={() => void refreshLeads()}
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="crm-alert-warning text-[11px]">
          {actionError}
        </div>
      )}

      {isEmptyAgency && (
        <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/15 px-6 py-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No leads yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your pipeline is empty — this is expected for a new agency. Leads from the TRAGUIN website will land here once connected.
          </p>
          <button
            type="button"
            onClick={openAddLeadModal}
            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Create your first lead
          </button>
        </div>
      )}

      {!isEmptyAgency && (
        <>
          <div className="crm-stats-toolbar">
            <select
              className="crm-stats-period"
              value={statsPeriod}
              onChange={(e) => setStatsPeriod(e.target.value as StatsPeriod)}
              aria-label="Stats period"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          <div className="crm-stats-bar">
            <div className="crm-stats-bar__item">
              <div className="crm-stats-bar__label">New</div>
              <div className="crm-stats-bar__value">{leadStats.newCount}</div>
            </div>
            <div className="crm-stats-bar__item">
              <div className="crm-stats-bar__label">Won</div>
              <div className="crm-stats-bar__value">{leadStats.wonCount}</div>
            </div>
            <div className="crm-stats-bar__item">
              <div className="crm-stats-bar__label">Lost</div>
              <div className="crm-stats-bar__value">{leadStats.lostCount}</div>
            </div>
            <div className="crm-stats-bar__item">
              <div className="crm-stats-bar__label">Total closed</div>
              <div className="crm-stats-bar__value">
                ₹{leadStats.totalClosed.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="crm-stats-bar__item">
              <div className="crm-stats-bar__label">Lead Conversion Rate</div>
              <div className="crm-stats-bar__value">
                {leadStats.conversionRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search, Filter, Sort Controls */}
      <div className="crm-filter-bar text-xs">
        <div className="crm-filter-bar__search">
          <Search className="crm-filter-bar__search-icon" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="crm-filter-bar__input"
          />
        </div>

        <div className="crm-filter-bar__select-wrap">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="crm-filter-bar__select"
            aria-label="Filter by assignee"
          >
            <option value="ALL">All assigned</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="crm-filter-bar__select-wrap">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="crm-filter-bar__select"
            aria-label="Sort leads"
          >
            <option value="date">Sort: Date added</option>
            <option value="value">Sort: Lead value</option>
          </select>
        </div>

        <div className="crm-filter-bar__actions">
          <button
            type="button"
            onClick={handleRefreshLeads}
            disabled={refreshingLeads || leadsLoading}
            className="crm-filter-bar__refresh"
            aria-label="Refresh leads"
            title="Refresh leads"
          >
            <RefreshCw className={refreshingLeads || leadsBackgroundLoading ? 'animate-spin' : ''} />
          </button>

          <div className="crm-view-toggle" role="tablist" aria-label="Lead layout">
            {LEAD_VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={leadView === opt.value}
                className={`crm-view-toggle__btn ${leadView === opt.value ? 'crm-view-toggle__btn--active' : ''}`}
                onClick={() => setLeadView(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <LeadIdLegend entries={leadAbbrevLegendEntries} />

      {leadView === 'kanban' && (
      /* Kanban Board Layout */
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = agencyLeads.filter((l) => leadMatchesStage(l.status, stage.id));
          const stageTotalValue = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);

          return (
            <div 
              key={stage.id} 
              className={`flex flex-col rounded-xl border border-border min-w-[11.5rem] w-[11.5rem] shrink-0 max-h-[70vh] ${stage.color} overflow-hidden`}
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-border/40 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-semibold text-xs text-foreground tracking-tight">{stage.name}</h3>
                  <span className="text-[10px] text-muted-foreground font-bold">
                    ₹{stageTotalValue.toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-bold">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {stageLeads.map((lead) => {
                  const assignee = staff.find(u => u.id === lead.assignedToId);
                  
                  return (
                    <div
                      key={lead.id}
                      onClick={() => navigateToLead(lead.id)}
                      className="p-3 bg-card border border-border/60 rounded-lg hover:border-indigo-500/40 hover:shadow-md cursor-pointer transition-all hover-card-trigger space-y-2 relative"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded truncate max-w-[5.75rem] tabular-nums">
                          {formatLeadDisplayCode(lead)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-500">
                          ₹{Number(lead.value).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <h4 className="font-semibold text-xs leading-tight tracking-tight text-foreground line-clamp-1">
                        {lead.title}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span className="truncate">
                          {lead.firstName} {lead.lastName}
                        </span>
                        
                        {assignee && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600/10 text-primary flex items-center justify-center font-bold text-[8px]" title={`Assigned to ${assignee.name}`}>
                            {assignee.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-[10px] text-muted-foreground/60 border border-dashed border-border/30 rounded-lg">
                    Stage empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {leadView === 'tiles' && (
      /* Tile grid — responsive cards, quick stage changes */
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
        {agencyLeads.map((lead) => {
          const assignee = staff.find((u) => u.id === lead.assignedToId);
          const stageName = pipelineStageName(lead.status);

          return (
            <div
              key={lead.id}
              className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col border-t-2 shadow-sm hover:border-indigo-500/35 hover:shadow-md transition-all ${pipelineStageTopClass(lead.status)}`}
            >
              <button
                type="button"
                onClick={() => navigateToLead(lead.id)}
                className="p-4 text-left space-y-2 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {stageName}
                  </span>
                  <span className="text-xs font-bold text-emerald-500 shrink-0">
                    ₹{Number(lead.value).toLocaleString('en-IN')}
                  </span>
                </div>
                <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{lead.title}</h3>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span className="truncate">
                    {lead.firstName} {lead.lastName}
                  </span>
                  {assignee && (
                    <span
                      className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/15 text-primary flex items-center justify-center font-bold text-[10px]"
                      title={`Assigned to ${assignee.name}`}
                    >
                      {assignee.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 pt-1">
                  <span className="truncate">{lead.source || 'Direct'}</span>
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
              <div
                className="px-4 pb-3 pt-0 border-t border-border/40 bg-secondary/20"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <label htmlFor={`stage-tile-${lead.id}`} className="sr-only">
                  Pipeline stage for {lead.title}
                </label>
                <select
                  id={`stage-tile-${lead.id}`}
                  value={resolvePipelineStage(lead.status)}
                  onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadPipelineStatus)}
                  className="mt-2 w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      Move to · {st.name}
                    </option>
                  ))}
                </select>
                <div
                  className={`mt-1.5 h-0.5 rounded-full opacity-70 ${pipelineStageBarClass(lead.status)}`}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
      {leadView === 'tiles' && agencyLeads.length === 0 && !isEmptyAgency && !leadsLoading && (
        <div className="rounded-xl border border-dashed border-border py-14 text-center text-[11px] text-muted-foreground">
          {hasActiveFilters
            ? 'No leads match your filters. Try adjusting search, assignee, or date range.'
            : 'No leads in this view.'}
        </div>
      )}

      {leadView === 'list' && (
      /* List view */
      <CrmTablePanel>
        <div className="crm-table-wrap">
        <div className="overflow-x-auto">
          <table className="crm-data-table min-w-[720px]">
            <thead>
              <tr>
                <th title="TEMP…-XX inquiry ID before booking · TG… after booking">Lead ID</th>
                <th>Contact</th>
                <th>Destination</th>
                <th>Source</th>
                <th className="w-[140px]">Status</th>
                <th className="whitespace-nowrap">Budget</th>
                <th>Assigned</th>
                <th className="hidden lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {leadsLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-2">
                    <CrmTableSkeleton columns={8} rows={8} />
                  </td>
                </tr>
              ) : (
              leadsTablePagination.pageItems.map((lead) => {
                const assigneePerson = staff.find((u) => u.id === lead.assignedToId);

                return (
                  <tr
                    key={lead.id}
                    onClick={() => navigateToLead(lead.id)}
                    className="cursor-pointer transition-colors"
                  >
                    <td
                      className="crm-lead-id whitespace-nowrap"
                      title={leadCodeLegendHint(lead.leadCode) ?? undefined}
                    >
                      {formatLeadDisplayCode(lead)}
                    </td>
                    <td>
                      <div className="font-medium text-foreground">
                        {lead.firstName} {lead.lastName}
                      </div>
                      {lead.email && (
                        <div className="text-[10px] truncate max-w-[180px] text-muted-foreground" title={lead.email}>
                          {lead.email}
                        </div>
                      )}
                    </td>
                    <td className="font-medium text-foreground max-w-[200px]">
                      <span className="line-clamp-2">{lead.title}</span>
                    </td>
                    <td className="text-muted-foreground">
                      {lead.source || '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        value={resolvePipelineStage(lead.status)}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value as LeadPipelineStatus)
                        }
                        className="w-full max-w-[136px] px-2 py-1 rounded-full bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-primary text-[11px]"
                      >
                        {stages.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="font-semibold whitespace-nowrap">
                      ₹{Number(lead.value).toLocaleString('en-IN')}
                    </td>
                    <td className="text-muted-foreground">
                      {assigneePerson ? assigneePerson.name : '—'}
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
        <CrmTablePagination
          label="Leads"
          rangeStart={leadsTablePagination.rangeStart}
          rangeEnd={leadsTablePagination.rangeEnd}
          total={leadsTablePagination.total}
          page={leadsTablePagination.page}
          totalPages={leadsTablePagination.totalPages}
          hasPrev={leadsTablePagination.hasPrev}
          hasNext={leadsTablePagination.hasNext}
          onPrev={leadsTablePagination.goPrev}
          onNext={leadsTablePagination.goNext}
          backgroundLoading={leadsBackgroundLoading}
        />
        </div>
        {agencyLeads.length === 0 && !isEmptyAgency && !leadsLoading && (
          <div className="crm-data-table__empty border-t border-border/60">
            {hasActiveFilters
              ? 'No leads match your filters. Try adjusting search, assignee, or date range.'
              : 'No leads in this view.'}
          </div>
        )}
      </CrmTablePanel>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">Record Customer Lead</h2>
              <button type="button" onClick={() => { setShowAddModal(false); resetLeadForm(); }} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* New vs existing customer */}
              <div className="space-y-3">
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                  Contact Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEntryModeChange('new')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border font-semibold transition-colors ${
                      leadEntryMode === 'new'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    New Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntryModeChange('existing')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border font-semibold transition-colors ${
                      leadEntryMode === 'existing'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Existing Customer
                  </button>
                </div>

                {leadEntryMode === 'new' && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed rounded-lg border border-border/40 bg-secondary/15 px-2.5 py-2">
                    We add or link a <strong className="text-foreground/80">Customer Directory</strong> profile for this
                    contact (same email reuses an existing card; leaving email blank creates a placeholder address you can edit later).
                  </p>
                )}

                {leadEntryMode === 'existing' && (
                  <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/60">
                    <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                      Select from Customer Directory
                    </label>
                    {!selectedCustomerId ? (
                      <div className="relative">
                        <input
                          type="text"
                          autoComplete="off"
                          aria-autocomplete="list"
                          aria-expanded={filteredCustomers.length > 0 && customerSearch.trim().length > 0}
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search by name, email, or phone..."
                          className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                        />
                        {customerSearch.trim() && filteredCustomers.length > 0 && (
                          <ul
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-border bg-card py-1 text-left shadow-xl"
                            role="listbox"
                          >
                            {filteredCustomers.slice(0, 12).map((c) => (
                              <li key={c.id} role="presentation">
                                <button
                                  type="button"
                                  role="option"
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-secondary/80 focus:bg-secondary/80 focus:outline-none"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    applyCustomerToForm(c.id);
                                    setCustomerSearch('');
                                  }}
                                >
                                  <span className="font-semibold text-foreground">
                                    {c.firstName} {c.lastName}
                                  </span>
                                  <span className="text-muted-foreground"> · {c.email}</span>
                                  {c.phone ? (
                                    <span className="block text-[10px] text-muted-foreground">{c.phone}</span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                    {selectedCustomer && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-[11px]">
                        <p className="text-emerald-500 font-medium">
                          <span className="font-bold text-muted-foreground">Selected: </span>
                          <span className="text-foreground">
                            {selectedCustomer.firstName} {selectedCustomer.lastName}
                          </span>
                          <span className="text-muted-foreground"> · {selectedCustomer.email}</span>
                        </p>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => applyCustomerToForm('')}
                        >
                          Change customer
                        </button>
                      </div>
                    )}
                    {customerSearch.trim() && !selectedCustomer && filteredCustomers.length === 0 && (
                      <p className="text-[10px] text-muted-foreground">No matching customers found.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Destination Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Kashmir Honeymoon Escape"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Message
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  placeholder="e.g. I want 5D/4N Kerala package."
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:border-primary focus:outline-none resize-y min-h-[4.5rem]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Client First Name
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={leadEntryMode === 'existing' && !!selectedCustomerId}
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border border-border focus:border-primary focus:outline-none ${
                      leadEntryMode === 'existing' && selectedCustomerId
                        ? 'bg-secondary/30 text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary/50'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Client Last Name
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={leadEntryMode === 'existing' && !!selectedCustomerId}
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}

                    className={`w-full px-3 py-2 rounded-lg border border-border focus:border-primary focus:outline-none ${
                      leadEntryMode === 'existing' && selectedCustomerId
                        ? 'bg-secondary/30 text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary/50'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    readOnly={leadEntryMode === 'existing' && !!selectedCustomerId}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onBlur={(e) => tryMatchCustomerByEmail(e.target.value)}

                    className={`w-full px-3 py-2 rounded-lg border border-border focus:border-primary focus:outline-none ${
                      leadEntryMode === 'existing' && selectedCustomerId
                        ? 'bg-secondary/30 text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary/50'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <PhoneInput
                    id="lead-phone"
                    variant="crm"
                    countryCode={newPhoneCountryCode}
                    onCountryCodeChange={setNewPhoneCountryCode}
                    value={newPhone}
                    onChange={setNewPhone}
                    readOnly={leadEntryMode === 'existing' && !!selectedCustomerId}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Referral">Client Referral</option>
                    <option value="Instagram">Social Ads</option>
                    <option value="WhatsApp">Direct WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Assign Agent
                  </label>
                  <select
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {leadEntryMode === 'existing' && selectedCustomerId && newAssigned && previousAgentName && (
                    <p className="text-[9px] text-emerald-500 mt-1 font-medium">
                      Auto-assigned to {previousAgentName} from previous lead
                    </p>
                  )}
                </div>
              </div>

              <LeadIntakeAlerts
                check={addIntakeCheck}
                loading={addIntakeCheckLoading}
                onOpenLead={(leadId) => {
                  setShowAddModal(false);
                  resetLeadForm();
                  navigateToLead(leadId);
                }}
                onUseCustomer={(customerId) => {
                  setLeadEntryMode('existing');
                  applyCustomerToForm(customerId);
                }}
              />

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetLeadForm(); }}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 disabled:pointer-events-none"
                >
                  {creatingLead ? 'Saving…' : 'Save Lead Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
