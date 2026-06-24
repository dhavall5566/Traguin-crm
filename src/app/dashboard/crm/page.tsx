'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useStore, Lead } from '@/lib/store';
import { useLeadsPage } from '@/hooks/useLeadsPage';
import { useCustomersPage } from '@/hooks/useCustomersPage';
import { useItineraryPage } from '@/hooks/useItineraryPage';
import { useBookingsInvoices } from '@/hooks/useBookingsInvoices';
import { createBooking as createBookingApi, mapBookingFromApi } from '@/lib/api/bookings';
import { createInvoice, mapInvoiceFromApi } from '@/lib/api/finance';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import {
  LeadTimelineActivityBody,
  LeadTimelineNoteBody,
} from '@/components/crm/LeadTimelineContent';
import { LeadTimelineAnimatedItem } from '@/components/crm/LeadTimelineAnimatedItem';
import { sortTimelineItems, isRedundantNoteActivity, dedupeAccidentalNotes, isPendingTimelineItem } from '@/lib/lead-timeline-format';
import {
  CrmItineraryCreationIntent,
  STORAGE_CREATE_ITIN_FROM_CRM,
  STORAGE_CRM_RESUME_BOOKING,
} from '@/lib/crmItineraryHandoff';
import {
  Plus,
  Search,
  RefreshCw,
  X,
  Activity,
  Trash2,
  Clock,
  UserPlus,
  Users,
  ClipboardList,
  Save,
  Check,
} from 'lucide-react';

type LeadDetailDraft = Pick<Lead, 'status' | 'value' | 'assignedToId'> & {
  source: string;
  message: string;
};

const stages = [
  { id: 'NEW', name: 'New Leads', color: 'border-t-indigo-500 bg-indigo-500/5' },
  { id: 'CONTACTED', name: 'Contacted', color: 'border-t-sky-500 bg-sky-500/5' },
  { id: 'PROPOSAL_SENT', name: 'Proposal Sent', color: 'border-t-amber-500 bg-amber-500/5' },
  { id: 'NEGOTIATION', name: 'Negotiation', color: 'border-t-pink-500 bg-pink-500/5' },
  { id: 'CONFIRMED', name: 'Confirmed', color: 'border-t-emerald-500 bg-emerald-500/5' },
  { id: 'LOST', name: 'Lost', color: 'border-t-zinc-500 bg-zinc-500/5' },
] as const;

/** Static classes for list row accent (avoid dynamic Tailwind strings). */
const STAGE_BAR: Record<(typeof stages)[number]['id'], string> = {
  NEW: 'bg-indigo-500',
  CONTACTED: 'bg-sky-500',
  PROPOSAL_SENT: 'bg-amber-500',
  NEGOTIATION: 'bg-pink-500',
  CONFIRMED: 'bg-emerald-500',
  LOST: 'bg-zinc-500',
};

/** Top border accent for tile cards (Tailwind-safe). */
const STAGE_TOP: Record<(typeof stages)[number]['id'], string> = {
  NEW: 'border-t-indigo-500',
  CONTACTED: 'border-t-sky-500',
  PROPOSAL_SENT: 'border-t-amber-500',
  NEGOTIATION: 'border-t-pink-500',
  CONFIRMED: 'border-t-emerald-500',
  LOST: 'border-t-zinc-500',
};


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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    leads,
    leadNotes,
    leadActivities,
    leadFollowups,
    staff,
    loading: leadsLoading,
    backgroundLoading: leadsBackgroundLoading,
    error: leadsError,
    refreshLeads,
    hydrateLeadDetail,
    addLead,
    updateLeadStatus,
    updateLead,
    updateLeadExtras,
    deleteLead,
    addLeadNote,
    addLeadFollowup,
  } = useLeadsPage();

  const { customers } = useCustomersPage();
  const { itineraries } = useItineraryPage();
  const { bookings, invoices, refresh: refreshBookingsInvoices } = useBookingsInvoices();

  const { currentAgency, currentUser, workspacePreferences } = useStore();

  const [actionError, setActionError] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const creatingLeadRef = useRef(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const creatingBookingRef = useRef(false);

  const runLeadAction = async (label: string, fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : `${label} failed`;
      setActionError(message);
      if (typeof window !== 'undefined') window.alert(message);
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

  // Modal / Selection — derive lead from store so dropdowns/input stay in sync after updateLead
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return (
      leads.find((l) => l.id === selectedLeadId && l.agencyId === currentAgency.id) ?? null
    );
  }, [leads, selectedLeadId, currentAgency.id]);

  useEffect(() => {
    if (selectedLeadId && selectedLead === null) {
      setSelectedLeadId(null);
    }
  }, [selectedLeadId, selectedLead]);

  useEffect(() => {
    if (!selectedLeadId) return;
    void hydrateLeadDetail(selectedLeadId);
  }, [selectedLeadId, hydrateLeadDetail]);

  /** Weekly Ops / bookmarks: `/dashboard/crm?openLead=<id>` opens the drawer for that card. */
  useEffect(() => {
    const raw = searchParams.get('openLead')?.trim();
    if (!raw) return;
    const leadExists = leads.some((l) => l.id === raw && l.agencyId === currentAgency.id);
    if (!leadExists) return;
    setSelectedLeadId(raw);
    router.replace('/dashboard/crm', { scroll: false });
  }, [searchParams, leads, currentAgency.id, router]);

  /** Booking conversion (lead drawer) */
  const [bookingItineraryId, setBookingItineraryId] = useState('');
  /** When true for one passive effect flush, suppress clearing itinerary pick after CRM ← builder round-trip */
  const applyingCrmBookingResumeRef = useRef(false);
  /** Tracks which lead card we already hydrated dropdown for — avoids wiping a staged itinerary on same-card store churn */
  const bookingHydrationLeadRef = useRef<string | null>(null);
  /** Itinerary id applied from SESSION_CRM resume before store options may reflect it — keep until list catches up */
  const pendingBookingResumePickRef = useRef<{ leadId: string; itineraryId: string } | null>(
    null,
  );

  const [saveToastVisible, setSaveToastVisible] = useState(false);
  useEffect(() => {
    if (!saveToastVisible) return undefined;
    const t = window.setTimeout(() => setSaveToastVisible(false), 2800);
    return () => window.clearTimeout(t);
  }, [saveToastVisible]);

  /** Editable snapshot for drawer pipeline fields until user clicks Save */
  const [leadDetailDraft, setLeadDetailDraft] = useState<LeadDetailDraft | null>(null);
  const leadDetailHydratedForIdRef = useRef<string | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [timelineEnterKeys, setTimelineEnterKeys] = useState<Set<string>>(() => new Set());
  const [timelineEnterTick, setTimelineEnterTick] = useState(0);
  const timelineEnterTimersRef = useRef<Map<string, number>>(new Map());

  const markTimelineEnter = (key: string) => {
    setTimelineEnterKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setTimelineEnterTick((t) => t + 1);

    const existing = timelineEnterTimersRef.current.get(key);
    if (existing !== undefined) window.clearTimeout(existing);

    const timer = window.setTimeout(() => {
      setTimelineEnterKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timelineEnterTimersRef.current.delete(key);
    }, 900);
    timelineEnterTimersRef.current.set(key, timer);
  };

  useEffect(() => {
    const timers = timelineEnterTimersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  useLayoutEffect(() => {
    if (!selectedLeadId) {
      leadDetailHydratedForIdRef.current = null;
      setLeadDetailDraft(null);
      return;
    }
    const snap = leads.find((l) => l.id === selectedLeadId && l.agencyId === currentAgency.id);
    if (!snap) return;
    if (leadDetailHydratedForIdRef.current !== selectedLeadId) {
      leadDetailHydratedForIdRef.current = selectedLeadId;
      setLeadDetailDraft({
        status: snap.status,
        value: snap.value,
        assignedToId: snap.assignedToId,
        source: snap.source ?? '',
        message: snap.message ?? '',
      });
    }
  }, [selectedLeadId, leads, currentAgency.id]);

  /** Display + save payload — only trust draft after it is hydrated for this lead id */
  const pipelineDraft: LeadDetailDraft | null = useMemo(() => {
    if (!selectedLead || !selectedLeadId) return null;
    const draftReadyForThisCard =
      leadDetailDraft != null && leadDetailHydratedForIdRef.current === selectedLeadId;
    if (draftReadyForThisCard && leadDetailDraft) {
      return leadDetailDraft;
    }
    return {
      status: selectedLead.status,
      value: selectedLead.value,
      assignedToId: selectedLead.assignedToId,
      source: selectedLead.source ?? '',
      message: selectedLead.message ?? '',
    };
  }, [selectedLead, selectedLeadId, leadDetailDraft]);

  /** Deal estimate shown in drawer: itinerary retail total when a proposal is picked, otherwise stored lead.value */
  const drawerResolvedDealValue = useMemo(() => {
    if (!pipelineDraft) return 0;
    if (bookingItineraryId) {
      const itin = itineraries.find(
        (i) => i.id === bookingItineraryId && i.agencyId === currentAgency.id,
      );
      if (itin) return Number(itin.totalPrice);
    }
    return Number(pipelineDraft.value);
  }, [pipelineDraft, bookingItineraryId, itineraries, currentAgency.id]);

  const leadDetailDirty = useMemo(() => {
    if (!selectedLead || !pipelineDraft) return false;
    return (
      pipelineDraft.status !== selectedLead.status ||
      drawerResolvedDealValue !== Number(selectedLead.value) ||
      (pipelineDraft.assignedToId || '') !== (selectedLead.assignedToId || '') ||
      (pipelineDraft.source || '') !== (selectedLead.source || '') ||
      (pipelineDraft.message || '') !== (selectedLead.message || '')
    );
  }, [selectedLead, pipelineDraft, drawerResolvedDealValue]);

  const bookingProposalDirty = useMemo(() => {
    if (!selectedLead) return false;
    return bookingItineraryId !== (selectedLead.proposalItineraryId ?? '');
  }, [selectedLead, bookingItineraryId]);

  const leadDrawerDirty = useMemo(
    () => leadDetailDirty || bookingProposalDirty,
    [leadDetailDirty, bookingProposalDirty],
  );

  /** Index into `stages` for lead drawer pipeline bar / copy (defaults to NEW if unknown) */
  const drawerPipelineStageIdx = useMemo(() => {
    if (!pipelineDraft) return 0;
    const i = stages.findIndex((s) => s.id === pipelineDraft.status);
    return i >= 0 ? i : 0;
  }, [pipelineDraft]);

  type DrawerTimelineEntry =
    | { kind: 'note'; id: string; at: string; author: string; content: string }
    | { kind: 'activity'; id: string; at: string; author: string; description: string }
    | { kind: 'followup'; id: string; at: string; scheduledAt: string; notes: string };

  const drawerTimeline = useMemo((): DrawerTimelineEntry[] => {
    if (!selectedLeadId) return [];
    const entries: DrawerTimelineEntry[] = [
      ...dedupeAccidentalNotes(leadNotes.filter((n) => n.leadId === selectedLeadId)).map((n) => ({
        kind: 'note' as const,
        id: n.id,
        at: n.createdAt,
        author: n.createdBy,
        content: n.content,
      })),
      ...leadActivities
        .filter((a) => a.leadId === selectedLeadId)
        .filter((a) => !isRedundantNoteActivity(a.description))
        .map((a) => ({
          kind: 'activity' as const,
          id: a.id,
          at: a.createdAt,
          author: a.createdBy,
          description: a.description,
        })),
      ...leadFollowups
        .filter((f) => f.leadId === selectedLeadId)
        .map((f) => ({
          kind: 'followup' as const,
          id: f.id,
          at: f.scheduledAt,
          scheduledAt: f.scheduledAt,
          notes: f.notes ?? '',
        })),
    ];
    return sortTimelineItems(entries);
  }, [selectedLeadId, leadNotes, leadActivities, leadFollowups]);

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [drawerTimeline, selectedLeadId]);

  useEffect(() => {
    if (timelineEnterTick === 0) return;
    const el = timelineScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [timelineEnterTick]);

  const selectLeadOpeningDrawer = (nextId: string) => {
    if (leadDrawerDirty && nextId !== selectedLeadId) {
      const ok = typeof window !== 'undefined' &&
        window.confirm('This lead has unsaved edits. Continue and discard them?');
      if (!ok) return;
    }
    if (nextId !== selectedLeadId) {
      leadDetailHydratedForIdRef.current = null;
      setLeadDetailDraft(null);
    }
    setSelectedLeadId(nextId);
  };

  const setDrawerPipeline = (patch: Partial<LeadDetailDraft>) => {
    if (!selectedLead) return;
    setLeadDetailDraft((prev) => {
      const base: LeadDetailDraft =
        prev ?? {
          status: selectedLead.status,
          value: selectedLead.value,
          assignedToId: selectedLead.assignedToId,
          source: selectedLead.source ?? '',
          message: selectedLead.message ?? '',
        };
      return { ...base, ...patch };
    });
  };

  const handleSaveLeadDetail = () => {
    if (!selectedLead || !pipelineDraft) return;
    if (!leadDrawerDirty) return;

    const id = selectedLead.id;

    void runLeadAction('Save lead', async () => {
      setSavingLead(true);
      try {
        if (pipelineDraft.status !== selectedLead.status) {
          await updateLeadStatus(id, pipelineDraft.status);
        }

        const updates: Partial<Lead> = {};
        if (drawerResolvedDealValue !== Number(selectedLead.value)) {
          updates.value = drawerResolvedDealValue;
        }
        const nextAssign = pipelineDraft.assignedToId || undefined;
        const curAssign = selectedLead.assignedToId ?? undefined;
        if (nextAssign !== curAssign) updates.assignedToId = nextAssign;
        if ((pipelineDraft.source || '') !== (selectedLead.source || '')) {
          updates.source = pipelineDraft.source;
        }
        if ((pipelineDraft.message || '') !== (selectedLead.message || '')) {
          updates.message = pipelineDraft.message.trim() || undefined;
        }
        if (
          (bookingItineraryId || '') !== ((selectedLead.proposalItineraryId ?? '') || '')
        ) {
          updates.proposalItineraryId = bookingItineraryId || undefined;
        }

        if (Object.keys(updates).length > 0) {
          await updateLead(id, updates);
        }

        setLeadDetailDraft({
          status: pipelineDraft.status,
          value: drawerResolvedDealValue,
          assignedToId: pipelineDraft.assignedToId,
          source: pipelineDraft.source ?? '',
          message: pipelineDraft.message ?? '',
        });

        setSaveToastVisible(true);
        setSelectedLeadId(null);
      } finally {
        setSavingLead(false);
      }
    });
  };

  const requestCloseLeadDrawer = () => {
    if (leadDrawerDirty) {
      const ok = typeof window !== 'undefined' &&
        window.confirm('You have unsaved changes. Close this card without saving?');
      if (!ok) return;
    }
    setSelectedLeadId(null);
  };

  // New Lead Form state
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newSource, setNewSource] = useState('Website');
  const [newAssigned, setNewAssigned] = useState('');
  const [leadEntryMode, setLeadEntryMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

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

    const previousLead = leads
      .filter((l) => l.agencyId === currentAgency.id && l.assignedToId)
      .filter(
        (l) =>
          l.customerId === customerId ||
          (customer.email && l.email?.toLowerCase() === customer.email.toLowerCase()) ||
          (l.firstName === customer.firstName && l.lastName === customer.lastName)
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    return previousLead?.assignedToId ?? '';
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
    setNewValue('');
    setNewSource('Website');
    setNewAssigned('');
    setLeadEntryMode('new');
    setSelectedCustomerId('');
    setCustomerSearch('');
  };

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
      setNewAssigned('');
      return;
    }
    const customer = agencyCustomers.find((c) => c.id === customerId);
    if (!customer) return;
    setNewFirstName(customer.firstName);
    setNewLastName(customer.lastName);
    setNewEmail(customer.email);
    setNewPhone(customer.phone ?? '');
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

  // Lead Details Notes/Reminders form state
  const [noteContent, setNoteContent] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');

  // Lead Details Notes/Reminders form state, current agency, and selected filter options
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
    const wonCount = agency.filter((l) => l.status === 'CONFIRMED').length;
    const lostCount = agency.filter((l) => l.status === 'LOST').length;
    const totalClosed = agency
      .filter((l) => l.status === 'CONFIRMED')
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

  const formatLeadId = (id: string) => {
    const compact = id.replace(/-/g, '').slice(-8).toUpperCase();
    return `LD-${new Date().getFullYear()}-${compact}`;
  };

  const bookableItineraries = useMemo(() => {
    const withDays = itineraries.filter(
      (i) =>
        i.agencyId === currentAgency.id &&
        (i.days?.length ?? 0) > 0,
    );
    if (!bookingItineraryId) return withDays;
    const pending = itineraries.find(
      (i) =>
        i.id === bookingItineraryId &&
        i.agencyId === currentAgency.id &&
        (i.days?.length ?? 0) === 0,
    );
    if (!pending) return withDays;
    if (withDays.some((i) => i.id === pending.id)) return withDays;
    return [pending, ...withDays];
  }, [itineraries, currentAgency.id, bookingItineraryId]);

  /** Ensures `<select value>` binds when the resumed id isn't in bookable yet (timing / filters) */
  const proposalSelectGhostItin = useMemo(() => {
    if (!bookingItineraryId) return undefined;
    if (bookableItineraries.some((i) => i.id === bookingItineraryId)) return undefined;
    return itineraries.find(
      (i) => i.id === bookingItineraryId && i.agencyId === currentAgency.id,
    );
  }, [bookingItineraryId, bookableItineraries, itineraries, currentAgency.id]);

  const emailMatchedCustomer = useMemo(() => {
    const em = selectedLead?.email?.trim();
    if (!em) return undefined;
    return agencyCustomers.find((c) => c.email.toLowerCase() === em.toLowerCase());
  }, [selectedLead?.email, agencyCustomers]);

  const effectiveCustomerId =
    selectedLead?.customerId || emailMatchedCustomer?.id;

  /**
   * Block a second “booking + draft invoice” while Billing still shows an open balance for this
   * traveller (Directory customer, or guest-name snapshot on bookings when not linked yet).
   */
  const hasOutstandingInvoiceForLeadTraveller = useMemo(() => {
    if (!selectedLead) return false;
    const agencyId = currentAgency.id;
    const bookingIds = new Set<string>();
    const cid = (effectiveCustomerId || '').trim();
    if (cid) {
      for (const b of bookings) {
        if (b.agencyId === agencyId && b.customerId === cid) bookingIds.add(b.id);
      }
    } else {
      const fn = (selectedLead.firstName || '').trim().toLowerCase();
      const ln = (selectedLead.lastName || '').trim().toLowerCase();
      if (!fn && !ln) return false;
      for (const b of bookings) {
        if (b.agencyId !== agencyId) continue;
        if ((b.customerId || '').trim()) continue;
        const gfn = (b.guestFirstName || '').trim().toLowerCase();
        const gln = (b.guestLastName || '').trim().toLowerCase();
        if (gfn === fn && gln === ln) bookingIds.add(b.id);
      }
    }
    if (bookingIds.size === 0) return false;
    return invoices.some(
      (inv) =>
        inv.agencyId === agencyId &&
        bookingIds.has(inv.bookingId) &&
        (inv.status === 'UNPAID' ||
          inv.status === 'PARTIALLY_PAID' ||
          inv.status === 'OVERDUE'),
    );
  }, [selectedLead, effectiveCustomerId, bookings, invoices, currentAgency.id]);

  /** Enables “Create booking…” only when an itinerary is chosen — customer is validated on click */
  const crmChosenProposalItineraryId = useMemo(
    () => (bookingItineraryId || selectedLead?.proposalItineraryId || '').trim(),
    [bookingItineraryId, selectedLead?.proposalItineraryId],
  );

  useLayoutEffect(() => {
    /* Re-run whenever we land on this route so itinerary → CRM client navigations pick up STORAGE
       even if this page stayed warm in memory (empty deps misses that). */
    if (pathname !== '/dashboard/crm') return;
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_CRM_RESUME_BOOKING);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { leadId?: string; itineraryId?: string };
      const lid = typeof parsed.leadId === 'string' ? parsed.leadId.trim() : '';
      const iid = typeof parsed.itineraryId === 'string' ? parsed.itineraryId.trim() : '';
      if (!lid || !iid) return;

      /** Auto-persist proposal when resuming so the dropdown aligns with stored `proposalItineraryId`. */
      const resumeLeadSnap = leads.find(
        (l) => l.id === lid && l.agencyId === currentAgency.id,
      );
      if (
        resumeLeadSnap &&
        ((resumeLeadSnap.proposalItineraryId ?? '').trim() || '') !== iid
      ) {
        updateLeadExtras(lid, { proposalItineraryId: iid });
      }

      pendingBookingResumePickRef.current = { leadId: lid, itineraryId: iid };
      applyingCrmBookingResumeRef.current = true;
      setSelectedLeadId(lid);
      setBookingItineraryId(iid);
    } catch {
      /* ignore malformed storage */
    }
  }, [pathname, leads, currentAgency.id, updateLeadExtras]);

  /**
   * Drop CRM resume markers only after itinerary + drawer id match what is in storage, so React
   * Strict Mode's double mount still sees the payload on pass two.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_CRM_RESUME_BOOKING);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { leadId?: string; itineraryId?: string };
      const lid = typeof parsed.leadId === 'string' ? parsed.leadId.trim() : '';
      const iid = typeof parsed.itineraryId === 'string' ? parsed.itineraryId.trim() : '';
      if (!lid || !iid || lid !== selectedLeadId || iid !== bookingItineraryId) return;
      sessionStorage.removeItem(STORAGE_CRM_RESUME_BOOKING);
    } catch {
      /* ignore malformed storage */
    }
  }, [selectedLeadId, bookingItineraryId]);

  useEffect(() => {
    const p = pendingBookingResumePickRef.current;
    if (!p || !selectedLeadId) return;
    if (p.leadId !== selectedLeadId) return;
    if (
      itineraries.some((i) => i.id === p.itineraryId && i.agencyId === currentAgency.id)
    ) {
      pendingBookingResumePickRef.current = null;
    }
  }, [itineraries, currentAgency.id, selectedLeadId]);

  /**
   * Keep proposal dropdown aligned with persisted `proposalItineraryId` when switching leads / after
   * Save — but do not clobber an in-card staged itinerary pick (creator round-trip) with empty persisted
   * data until Save runs.
   */
  useEffect(() => {
    if (applyingCrmBookingResumeRef.current) {
      applyingCrmBookingResumeRef.current = false;
      if (selectedLeadId) {
        bookingHydrationLeadRef.current = selectedLeadId;
      }
      return;
    }
    if (!selectedLeadId) {
      bookingHydrationLeadRef.current = null;
      pendingBookingResumePickRef.current = null;
      setBookingItineraryId('');
      return;
    }
    if (!selectedLead || selectedLead.id !== selectedLeadId) return;

    const persisted = selectedLead.proposalItineraryId ?? '';
    const leadBucketChanged = bookingHydrationLeadRef.current !== selectedLeadId;

    if (leadBucketChanged) {
      bookingHydrationLeadRef.current = selectedLeadId;
      pendingBookingResumePickRef.current = null;
      setBookingItineraryId(persisted);
      return;
    }

    if (persisted) {
      setBookingItineraryId(persisted);
      return;
    }

    setBookingItineraryId((prev) => {
      const pending = pendingBookingResumePickRef.current;
      const matchesResume =
        !!pending &&
        pending.leadId === selectedLeadId &&
        !!prev &&
        pending.itineraryId === prev;
      const prevValid =
        !!prev &&
        (itineraries.some((i) => i.id === prev && i.agencyId === currentAgency.id) ||
          matchesResume);
      return prevValid ? prev : '';
    });
  }, [
    selectedLeadId,
    selectedLead?.id,
    selectedLead?.proposalItineraryId,
    itineraries,
    currentAgency.id,
  ]);

  const handleCreateBookingFromCrm = () => {
    if (!selectedLead) return;
    if (creatingBookingRef.current) return;

    if (hasOutstandingInvoiceForLeadTraveller) {
      alert(
        'This traveller already has an unpaid or partially paid invoice in Billing. Record payment (or close the balance) before creating another booking with a draft invoice.',
      );
      return;
    }

    /** Directory profile is independent of conversion — bookings can exist before a traveller card exists */
    const cid = (effectiveCustomerId || '').trim();

    const itineraryId = (
      bookingItineraryId ||
      selectedLead?.proposalItineraryId ||
      ''
    ).trim();
    if (!itineraryId) {
      alert('Pick an itinerary to attach to this booking.');
      return;
    }

    const duplicate = bookings.some(
      (b) =>
        b.agencyId === currentAgency.id &&
        b.customerId === cid &&
        b.itineraryId === itineraryId,
    );
    if (duplicate) {
      alert(
        'A booking already exists for this itinerary. Open Billing & ERP Finance for invoice details.',
      );
      return;
    }

    const itinerary = itineraries.find(
      (i) => i.id === itineraryId && i.agencyId === currentAgency.id,
    );
    if (!itinerary) {
      alert(
        'Itinerary not found for this workspace. Pick a trip from the list or open Trip planner.',
      );
      return;
    }

    creatingBookingRef.current = true;
    setCreatingBooking(true);

    void runLeadAction('Create booking', async () => {
      try {
        if (!cid) {
          alert('Link or create a customer profile before converting to a booking.');
          return;
        }

        if (cid && cid !== (selectedLead.customerId || '').trim()) {
          await updateLead(selectedLead.id, { customerId: cid });
        }

        const apiBooking = await createBookingApi({
          customerId: cid,
          itineraryId,
          status: 'PENDING',
        });
        const newBooking = mapBookingFromApi(apiBooking);

        const dueDays = Math.min(
          365,
          Math.max(1, Math.round(Number(workspacePreferences.defaultInvoiceDueDays) || 30)),
        );
        const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;

        let draftedInvoice = null as ReturnType<typeof mapInvoiceFromApi> | null;
        try {
          const apiInvoice = await createInvoice({
            bookingId: newBooking.id,
            invoiceNumber,
            amount: Number(itinerary.totalPrice) || 0,
            dueDate,
            status: 'UNPAID',
          });
          draftedInvoice = mapInvoiceFromApi(apiInvoice);
        } catch {
          /* booking succeeded; invoice can be created from Billing */
        }

        await refreshBookingsInvoices();

        const invNo = draftedInvoice?.invoiceNumber;
        const invAmt = draftedInvoice != null ? Number(draftedInvoice.amount) : 0;

        await updateLeadStatus(selectedLead.id, 'CONFIRMED');
        const { promise: bookingNotePromise } = addLeadNote(
          selectedLead.id,
          `Converted to booking on "${itinerary.title}". Draft invoice${invNo ? ` ${invNo}` : ''} — ₹${invAmt.toLocaleString('en-IN')}${!draftedInvoice ? ' (see Billing)' : ''}. Record payments in Billing & ERP Finance.`,
          currentUser?.name ?? 'System',
        );
        await bookingNotePromise;

        if (!draftedInvoice) {
          alert(
            'Booking was created, but no draft invoice was generated (trip data may be out of sync). You were taken to Billing — use “Record payment” on the invoice if it appears.',
          );
        }

        /** Close lead drawer and open Billing (invoices / Accounts Receivable is the default tab) */
        setSelectedLeadId(null);
        router.push('/dashboard/finance');
      } finally {
        creatingBookingRef.current = false;
        setCreatingBooking(false);
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingLeadRef.current) return;
    if (leadEntryMode === 'existing' && !selectedCustomerId) return;

    void runLeadAction('Create lead', async () => {
      creatingLeadRef.current = true;
      setCreatingLead(true);
      try {
        const created = await addLead({
          title: newTitle,
          firstName: newFirstName,
          lastName: newLastName,
          email: newEmail || undefined,
          phone: newPhone || undefined,
          status: 'NEW',
          value: Number(newValue) || 0,
          source: newSource,
          assignedToId: newAssigned || undefined,
          customerId: selectedCustomerId || undefined,
          message: newMessage.trim() || undefined,
        });
        if (!created) return;

        resetLeadForm();
        setShowAddModal(false);
      } finally {
        creatingLeadRef.current = false;
        setCreatingLead(false);
      }
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !noteContent.trim()) return;

    const content = noteContent.trim();
    setNoteContent('');

    const { tempId, promise } = addLeadNote(
      selectedLead.id,
      content,
      currentUser?.name ?? 'You',
    );
    if (!tempId) return;

    markTimelineEnter(`note-${tempId}`);

    void promise.catch((error) => {
      setNoteContent(content);
      const message = error instanceof Error ? error.message : 'Add note failed';
      setActionError(message);
      if (typeof window !== 'undefined') window.alert(message);
    });
  };

  const handleAddFollowup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !followupDate) return;

    const scheduledAt = new Date(followupDate).toISOString();
    const notes = followupNotes;
    const dateDraft = followupDate;
    setFollowupDate('');
    setFollowupNotes('');

    const { tempId, promise } = addLeadFollowup(
      selectedLead.id,
      scheduledAt,
      notes,
      currentUser?.name ?? 'You',
    );
    if (!tempId) {
      setFollowupDate(dateDraft);
      setFollowupNotes(notes);
      return;
    }

    markTimelineEnter(`fup-${tempId}`);

    void promise.catch((error) => {
      setFollowupDate(dateDraft);
      setFollowupNotes(notes);
      const message = error instanceof Error ? error.message : 'Schedule followup failed';
      setActionError(message);
      if (typeof window !== 'undefined') window.alert(message);
    });
  };

  const handleStatusChange = (leadId: string, status: Lead['status']) => {
    void runLeadAction('Update status', () => updateLeadStatus(leadId, status));
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
      {saveToastVisible && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-semibold shadow-lg shadow-black/20"
        >
          Changes saved successfully
        </div>
      )}
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
        <div className="crm-alert-error text-xs">
          Could not load leads: {leadsError}
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

      {leadView === 'kanban' && (
      /* Kanban Board Layout */
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageLeads = agencyLeads.filter(l => l.status === stage.id);
          const stageTotalValue = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);

          return (
            <div 
              key={stage.id} 
              className={`flex flex-col rounded-xl border border-border min-w-[200px] max-h-[70vh] ${stage.color} overflow-hidden`}
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
                      onClick={() => selectLeadOpeningDrawer(lead.id)}
                      className="p-3 bg-card border border-border/60 rounded-lg hover:border-indigo-500/40 hover:shadow-md cursor-pointer transition-all hover-card-trigger space-y-2 relative"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded truncate max-w-[80px]">
                          {lead.source || 'Direct'}
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
          const stageName = stages.find((s) => s.id === lead.status)?.name ?? lead.status;

          return (
            <div
              key={lead.id}
              className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col border-t-2 shadow-sm hover:border-indigo-500/35 hover:shadow-md transition-all ${STAGE_TOP[lead.status]}`}
            >
              <button
                type="button"
                onClick={() => selectLeadOpeningDrawer(lead.id)}
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
                  value={lead.status}
                  onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
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
                  className={`mt-1.5 h-0.5 rounded-full opacity-70 ${STAGE_BAR[lead.status]}`}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
      {leadView === 'tiles' && agencyLeads.length === 0 && !isEmptyAgency && (
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
                <th>Lead ID</th>
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
                    onClick={() => selectLeadOpeningDrawer(lead.id)}
                    className="cursor-pointer transition-colors"
                  >
                    <td className="crm-lead-id whitespace-nowrap">
                      {formatLeadId(lead.id)}
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
                        value={lead.status}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value as Lead['status'])
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
        {agencyLeads.length === 0 && !isEmptyAgency && (
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

              <div className="grid grid-cols-2 gap-4">
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
                  <input
                    type="text"
                    readOnly={leadEntryMode === 'existing' && !!selectedCustomerId}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    
                    className={`w-full px-3 py-2 rounded-lg border border-border focus:border-primary focus:outline-none ${
                      leadEntryMode === 'existing' && selectedCustomerId
                        ? 'bg-secondary/30 text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary/50'
                    }`}
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

      {/* Lead Details Drawer */}
      {selectedLead && pipelineDraft && (
        <div className="crm-lead-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title">
          <div className="crm-lead-drawer animate-scale-in">
            <header className="crm-lead-drawer__header">
              <div className="min-w-0 flex-1">
                <span className="crm-lead-drawer__eyebrow">Lead card</span>
                <h2 id="lead-drawer-title" className="crm-lead-drawer__title">
                  {selectedLead.title}
                </h2>
                <div className="crm-lead-drawer__meta">
                  <span className="crm-lead-drawer__meta-item">
                    {selectedLead.firstName} {selectedLead.lastName}
                  </span>
                  {selectedLead.email && (
                    <span className="crm-lead-drawer__meta-item">{selectedLead.email}</span>
                  )}
                  {selectedLead.phone && (
                    <span className="crm-lead-drawer__meta-item">{selectedLead.phone}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={requestCloseLeadDrawer}
                className="crm-lead-drawer__close"
                aria-label="Close lead details"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="crm-lead-drawer__body">
              <div className="crm-lead-drawer__main">
                <section className="crm-lead-drawer__section" aria-label="Pipeline stage progress">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="crm-lead-drawer__section-title" style={{ margin: 0 }}>
                      Stage progress
                    </h3>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {stages[drawerPipelineStageIdx]?.name ?? pipelineDraft.status}
                      <span className="ml-2 font-normal text-[var(--muted-foreground)] tabular-nums">
                        {drawerPipelineStageIdx + 1}/{stages.length}
                      </span>
                    </span>
                  </div>
                  <div className="crm-lead-drawer__stepper" role="group" aria-label="Pipeline stages">
                    {stages.map((st, i) => {
                      const pi = drawerPipelineStageIdx;
                      const isPast = i < pi;
                      const isCurrent = i === pi;
                      const stepClasses = [
                        'crm-lead-drawer__step',
                        isPast ? 'crm-lead-drawer__step--past' : '',
                        isCurrent ? 'crm-lead-drawer__step--current' : '',
                        isCurrent && st.id === 'LOST' ? 'crm-lead-drawer__step--lost' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <React.Fragment key={st.id}>
                          <button
                            type="button"
                            className={stepClasses}
                            title={`Set stage to ${st.name}`}
                            onClick={() => setDrawerPipeline({ status: st.id as Lead['status'] })}
                          >
                            <span className="crm-lead-drawer__step-node">
                              {isPast ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                            </span>
                            <span className="crm-lead-drawer__step-label">{st.name}</span>
                          </button>
                          {i < stages.length - 1 && (
                            <div
                              className={`crm-lead-drawer__step-connector ${pi > i ? 'crm-lead-drawer__step-connector--done' : ''}`}
                              aria-hidden
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </section>

                <section className="crm-lead-drawer__section">
                  <h3 className="crm-lead-drawer__section-title">Pipeline fields</h3>
                  <div className="crm-lead-drawer__fields">
                    <div>
                      <label
                        htmlFor={`lead-pipeline-status-${selectedLead.id}`}
                        className="crm-lead-drawer__field-label"
                      >
                        Lead status
                      </label>
                      <select
                        key={selectedLead.id}
                        id={`lead-pipeline-status-${selectedLead.id}`}
                        value={pipelineDraft.status}
                        onChange={(e) =>
                          setDrawerPipeline({ status: e.target.value as Lead['status'] })
                        }
                        className="crm-lead-drawer__select"
                      >
                        {stages.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`lead-deal-value-${selectedLead.id}`}
                        className="crm-lead-drawer__field-label"
                      >
                        Est. value (₹)
                      </label>
                      <input
                        id={`lead-deal-value-${selectedLead.id}`}
                        type="text"
                        readOnly
                        disabled
                        value={`₹${(Number.isFinite(drawerResolvedDealValue) ? drawerResolvedDealValue : 0).toLocaleString('en-IN')}`}
                        title={
                          bookingItineraryId
                            ? 'Total from selected proposal itinerary'
                            : 'Attach an itinerary to sync total'
                        }
                        className="crm-lead-drawer__input"
                      />
                      <p className="crm-lead-drawer__hint">
                        {bookingItineraryId
                          ? 'Synced from itinerary total.'
                          : 'Select an itinerary below to populate.'}
                      </p>
                    </div>
                    <div>
                      <label className="crm-lead-drawer__field-label" htmlFor={`lead-assign-${selectedLead.id}`}>
                        Assign employee
                      </label>
                      <select
                        id={`lead-assign-${selectedLead.id}`}
                        value={pipelineDraft.assignedToId || ''}
                        onChange={(e) =>
                          setDrawerPipeline({ assignedToId: e.target.value || undefined })
                        }
                        className="crm-lead-drawer__select"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="crm-lead-drawer__field-label" htmlFor={`lead-source-${selectedLead.id}`}>
                        Source
                      </label>
                      <input
                        id={`lead-source-${selectedLead.id}`}
                        type="text"
                        value={pipelineDraft.source ?? ''}
                        onChange={(e) => setDrawerPipeline({ source: e.target.value })}
                        className="crm-lead-drawer__input"
                      />
                    </div>
                  </div>
                </section>

                <section className="crm-lead-drawer__section">
                  <h3 className="crm-lead-drawer__section-title">Customer contact</h3>
                  <div className="crm-lead-drawer__profile-grid">
                    <div>
                      <span className="crm-lead-drawer__profile-label">Full name</span>
                      <p className="crm-lead-drawer__profile-value">
                        {selectedLead.firstName} {selectedLead.lastName}
                      </p>
                    </div>
                    <div>
                      <span className="crm-lead-drawer__profile-label">Source channel</span>
                      <p className="crm-lead-drawer__profile-value">
                        {(pipelineDraft.source ?? selectedLead.source ?? '').trim() || 'Manual CRM input'}
                      </p>
                    </div>
                    <div>
                      <span className="crm-lead-drawer__profile-label">Email</span>
                      <p className="crm-lead-drawer__profile-value">{selectedLead.email || '—'}</p>
                    </div>
                    <div>
                      <span className="crm-lead-drawer__profile-label">Phone</span>
                      <p className="crm-lead-drawer__profile-value">{selectedLead.phone || '—'}</p>
                    </div>
                  </div>
                </section>

                <section className="crm-lead-drawer__section">
                  <h3 className="crm-lead-drawer__section-title">Message</h3>
                  <label
                    htmlFor={`lead-message-${selectedLead.id}`}
                    className="crm-lead-drawer__field-label"
                  >
                    Customer inquiry
                  </label>
                  <textarea
                    id={`lead-message-${selectedLead.id}`}
                    value={pipelineDraft.message}
                    onChange={(e) => setDrawerPipeline({ message: e.target.value })}
                    rows={4}
                    placeholder="e.g. I want 5D/4N Kerala package."
                    className="crm-lead-drawer__message"
                  />
                </section>

                <section className="crm-lead-drawer__section crm-lead-drawer__booking">
                  <h3 className="crm-lead-drawer__booking-title">
                    <ClipboardList className="h-4 w-4 text-[var(--gold)]" aria-hidden />
                    Convert to booking &amp; invoice
                  </h3>
                  <label className="crm-lead-drawer__field-label" htmlFor={`lead-itin-${selectedLead.id}`}>
                    Proposal / itinerary ({bookableItineraries.length})
                  </label>
                  <select
                    id={`lead-itin-${selectedLead.id}`}
                    value={bookingItineraryId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__create_itinerary__') {
                        try {
                          const payload: CrmItineraryCreationIntent = {
                            leadId: selectedLead.id,
                            customerId: '',
                            leadGoalTitle: (selectedLead.title ?? '').trim(),
                            leadMessage: (selectedLead.message ?? '').trim(),
                          };
                          sessionStorage.setItem(STORAGE_CREATE_ITIN_FROM_CRM, JSON.stringify(payload));
                        } catch {
                          /* ignore */
                        }
                        router.push('/dashboard/itinerary');
                        return;
                      }
                      pendingBookingResumePickRef.current = null;
                      setBookingItineraryId(v);
                    }}
                    className="crm-lead-drawer__select"
                  >
                    <option value="">Choose itinerary…</option>
                    <option value="__create_itinerary__">+ Create new itinerary…</option>
                    {bookingItineraryId &&
                    !bookableItineraries.some((i) => i.id === bookingItineraryId) ? (
                      <option value={bookingItineraryId}>
                        {proposalSelectGhostItin
                          ? `${proposalSelectGhostItin.title} · ₹${Number(proposalSelectGhostItin.totalPrice).toLocaleString('en-IN')}`
                          : 'Trip from Trip planner…'}
                      </option>
                    ) : null}
                    {bookableItineraries.map((itin) => (
                      <option key={itin.id} value={itin.id}>
                        {itin.title} · ₹{Number(itin.totalPrice).toLocaleString('en-IN')}
                        {itin.startDate ? ` · ${itin.startDate}` : ''}
                      </option>
                    ))}
                  </select>
                  {bookableItineraries.length === 0 && (
                    <p className="crm-lead-drawer__hint">Add days to a trip on the Trip planner page.</p>
                  )}
                  <button
                    type="button"
                    disabled={
                      !crmChosenProposalItineraryId ||
                      hasOutstandingInvoiceForLeadTraveller ||
                      creatingBooking
                    }
                    title={
                      creatingBooking
                        ? 'Creating booking and invoice…'
                        : !crmChosenProposalItineraryId
                          ? 'Choose a proposal itinerary first'
                          : hasOutstandingInvoiceForLeadTraveller
                            ? 'Settle outstanding invoice before creating another booking'
                            : 'Create booking and draft invoice'
                    }
                    onClick={handleCreateBookingFromCrm}
                    className="crm-lead-drawer__btn-primary"
                  >
                    {creatingBooking ? 'Creating…' : 'Create booking + draft invoice'}
                  </button>
                </section>
              </div>

              <aside className="crm-lead-drawer__aside">
                <div className="crm-lead-drawer__timeline-head">
                  <span className="crm-lead-drawer__timeline-title">
                    <Activity className="h-4 w-4 text-[var(--gold)]" aria-hidden />
                    Activity timeline
                  </span>
                </div>

                <div className="crm-lead-drawer__timeline-scroll" ref={timelineScrollRef}>
                  {drawerTimeline.length === 0 ? (
                    <p className="crm-lead-drawer__timeline-empty">No activity yet — add a note below.</p>
                  ) : (
                    drawerTimeline.map((entry) => {
                      if (entry.kind === 'note') {
                        return (
                          <LeadTimelineAnimatedItem
                            key={`note-${entry.id}`}
                            animate={timelineEnterKeys.has(`note-${entry.id}`)}
                            className={[
                              'crm-lead-drawer__note-card',
                              isPendingTimelineItem(entry.id)
                                ? 'crm-lead-drawer__note-card--pending'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <div className="crm-lead-drawer__card-meta">
                              <span>Note · {entry.author}</span>
                              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                            </div>
                            <LeadTimelineNoteBody content={entry.content} />
                          </LeadTimelineAnimatedItem>
                        );
                      }
                      if (entry.kind === 'activity') {
                        return (
                          <div key={`act-${entry.id}`} className="crm-lead-drawer__activity-row">
                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <LeadTimelineActivityBody
                                description={entry.description}
                                author={entry.author}
                              />
                              <time
                                className="mt-1 block text-xs text-[var(--muted-foreground)]"
                                dateTime={entry.at}
                              >
                                {new Date(entry.at).toLocaleString()}
                              </time>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <LeadTimelineAnimatedItem
                          key={`fup-${entry.id}`}
                          animate={timelineEnterKeys.has(`fup-${entry.id}`)}
                          className={[
                            'crm-lead-drawer__followup-card',
                            isPendingTimelineItem(entry.id)
                              ? 'crm-lead-drawer__followup-card--pending'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="crm-lead-drawer__card-meta">
                            <span>Follow-up scheduled</span>
                            <time dateTime={entry.scheduledAt}>
                              {new Date(entry.scheduledAt).toLocaleDateString()}
                            </time>
                          </div>
                          <p className="crm-lead-drawer__card-body">{entry.notes || 'No notes'}</p>
                        </LeadTimelineAnimatedItem>
                      );
                    })
                  )}
                </div>

                <div className="crm-lead-drawer__composer">
                  <form onSubmit={handleAddNote} className="crm-lead-drawer__composer-row">
                    <input
                      type="text"
                      required
                      placeholder="Add a call log or note…"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="crm-lead-drawer__composer-input"
                    />
                    <button
                      type="submit"
                      className="crm-lead-drawer__composer-btn crm-lead-drawer__composer-btn--note"
                      disabled={!noteContent.trim()}
                    >
                      Add note
                    </button>
                  </form>

                  <form onSubmit={handleAddFollowup} className="crm-lead-drawer__followup-box">
                    <span className="crm-lead-drawer__field-label" style={{ margin: 0 }}>
                      Schedule follow-up
                    </span>
                    <div className="crm-lead-drawer__followup-fields">
                      <input
                        type="date"
                        required
                        value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="crm-lead-drawer__composer-input"
                        style={{ maxWidth: '12rem' }}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Reminder notes…"
                        value={followupNotes}
                        onChange={(e) => setFollowupNotes(e.target.value)}
                        className="crm-lead-drawer__composer-input"
                      />
                      <button
                        type="submit"
                        className="crm-lead-drawer__composer-btn crm-lead-drawer__composer-btn--schedule"
                        disabled={!followupDate}
                      >
                        Schedule
                      </button>
                    </div>
                  </form>
                </div>
              </aside>
            </div>

            <footer className="crm-lead-drawer__footer">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete lead record permanently?')) {
                    void runLeadAction('Delete lead', async () => {
                      await deleteLead(selectedLead.id);
                      setSelectedLeadId(null);
                    });
                  }
                }}
                className="crm-lead-drawer__btn-danger"
              >
                <Trash2 className="h-4 w-4" />
                Delete record
              </button>
              <button
                type="button"
                onClick={handleSaveLeadDetail}
                disabled={!leadDrawerDirty || savingLead}
                title={leadDrawerDirty ? 'Save pipeline changes' : 'No changes to save'}
                className="crm-lead-drawer__btn-save"
              >
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                {savingLead ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
