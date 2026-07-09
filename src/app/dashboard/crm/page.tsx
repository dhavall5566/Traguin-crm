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
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { defaultCountryCode } from '@/data/country-codes';
import { formatFullPhone, parsePhoneNumber } from '@/lib/phone-input';
import {
  LeadTimelineActivityBody,
  LeadTimelineNoteBody,
} from '@/components/crm/LeadTimelineContent';
import { LeadIntakeDetailsPanel } from '@/components/crm/LeadIntakeDetailsPanel';
import { LeadIntakeAlerts } from '@/components/crm/LeadIntakeAlerts';
import { checkLeadIntake, type LeadIntakeCheckResult } from '@/lib/api/leads';
import { findLeadIntakeNote } from '@/lib/lead-intake-display';
import { LeadTimelineAnimatedItem } from '@/components/crm/LeadTimelineAnimatedItem';
import { LeadDetailsForm } from '@/components/crm/LeadDetailsForm';
import { useCmsPackageSummary, usePackagesForDestination } from '@/hooks/usePackagesCatalog';
import {
  createItineraryFromCmsPackage,
  getItinerary,
  mapItineraryFromApi,
} from '@/lib/api/itineraries';
import { sortTimelineItems, isRedundantNoteActivity, dedupeAccidentalNotes, isPendingTimelineItem } from '@/lib/lead-timeline-format';
import { formatLeadDisplayCode, leadCodeLegendHint, buildActiveLegendEntries } from '@/lib/lead-codes';
import { LeadIdLegend } from '@/components/crm/LeadIdLegend';
import { crmToastError, crmToastInfo, crmToastSuccess } from '@/lib/crm-toast-bus';
import {
  pickLeadDetails,
  leadDetailsEqual,
  type LeadDetailsFields,
} from '@/lib/lead-details';
import {
  CrmItineraryCreationIntent,
  STORAGE_CREATE_ITIN_FROM_CRM,
  STORAGE_CRM_RESUME_BOOKING,
  readCrmBookingResumeFromStorage,
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

type LeadDetailDraft = Pick<
  Lead,
  'status' | 'value' | 'assignedToId' | 'cmsPackageId' | 'priority' | 'leadCategory'
> & {
  source: string;
  message: string;
  details: LeadDetailsFields;
};

import {
  LEAD_PRIORITY_OPTIONS,
  normalizeLeadPriority,
  type LeadPriority,
} from '@/lib/lead-priority';
const LEAD_CATEGORY_OPTIONS: { value: Lead['leadCategory']; label: string }[] = [
  { value: 'DOMESTIC', label: 'Domestic' },
  { value: 'INTERNATIONAL', label: 'International' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'VISA_ONLY', label: 'Visa Only' },
];

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
  const { itineraries, hydrateItineraryDetail } = useItineraryPage();
  const { bookings, invoices, refresh: refreshBookingsInvoices } = useBookingsInvoices();

  const { currentAgency, currentUser, workspacePreferences } = useStore();

  const [actionError, setActionError] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const creatingLeadRef = useRef(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const creatingBookingRef = useRef(false);
  const [resumeItineraryPreview, setResumeItineraryPreview] = useState<{
    id: string;
    title: string;
    totalPrice: number;
  } | null>(null);

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

  /** Editable snapshot for drawer pipeline fields until user clicks Save */
  const [leadDetailDraft, setLeadDetailDraft] = useState<LeadDetailDraft | null>(null);
  const leadDetailHydratedForIdRef = useRef<string | null>(null);
  /** Last server status for open drawer — used to sync draft after list/tile status changes */
  const leadDetailServerStatusRef = useRef<string | null>(null);
  /** Last server assignee for open drawer — syncs when assignment is rejected remotely */
  const leadDetailServerAssignRef = useRef<string | undefined>(undefined);
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
      leadDetailServerStatusRef.current = snap.status;
      leadDetailServerAssignRef.current = snap.assignedToId;
      setLeadDetailDraft({
        status: snap.status,
        value: snap.value,
        assignedToId: snap.assignedToId,
        cmsPackageId: snap.cmsPackageId,
        priority: snap.priority,
        leadCategory: snap.leadCategory,
        source: snap.source ?? '',
        message: snap.message ?? '',
        details: pickLeadDetails(snap),
      });
      return;
    }

    const prevServerStatus = leadDetailServerStatusRef.current;
    const prevServerAssign = leadDetailServerAssignRef.current;
    const nextServerAssign = snap.assignedToId;

    if (
      (prevServerStatus !== null && prevServerStatus !== snap.status) ||
      prevServerAssign !== nextServerAssign
    ) {
      setLeadDetailDraft((prev) => {
        if (prev == null) return prev;
        let next = prev;
        if (prevServerStatus !== null && prevServerStatus !== snap.status && prev.status === prevServerStatus) {
          next = { ...next, status: snap.status };
        }
        const draftAssign = prev.assignedToId ?? undefined;
        const trackedAssign = prevServerAssign ?? undefined;
        const serverAssign = nextServerAssign ?? undefined;
        if (draftAssign === trackedAssign && draftAssign !== serverAssign) {
          next = { ...next, assignedToId: nextServerAssign };
        }
        return next;
      });
    }
    leadDetailServerStatusRef.current = snap.status;
    leadDetailServerAssignRef.current = nextServerAssign;
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
      cmsPackageId: selectedLead.cmsPackageId,
      priority: selectedLead.priority,
      leadCategory: selectedLead.leadCategory,
      source: selectedLead.source ?? '',
      message: selectedLead.message ?? '',
      details: pickLeadDetails(selectedLead),
    };
  }, [selectedLead, selectedLeadId, leadDetailDraft]);

  const destinationPackages = usePackagesForDestination(pipelineDraft?.details.travelDestination);
  const { summary: selectedProposalPackage } = useCmsPackageSummary(pipelineDraft?.cmsPackageId);
  const leadPackageMode =
    pipelineDraft?.details.packageMode ??
    (pipelineDraft?.cmsPackageId ? 'PRE_BUILT' : bookingItineraryId ? 'CUSTOM' : undefined);
  const showPrebuiltPackagePicker = leadPackageMode !== 'CUSTOM';
  const showTripPlannerPicker = leadPackageMode !== 'PRE_BUILT';

  /** Deal estimate shown in drawer: itinerary total, CMS package price, or stored lead.value */
  const drawerResolvedDealValue = useMemo(() => {
    if (!pipelineDraft) return 0;
    if (bookingItineraryId) {
      const itin = itineraries.find(
        (i) => i.id === bookingItineraryId && i.agencyId === currentAgency.id,
      );
      if (itin) return Number(itin.totalPrice);
    }
    if (leadPackageMode === 'PRE_BUILT' && selectedProposalPackage) {
      return Number(selectedProposalPackage.price);
    }
    return Number(pipelineDraft.value);
  }, [
    pipelineDraft,
    bookingItineraryId,
    itineraries,
    currentAgency.id,
    leadPackageMode,
    selectedProposalPackage,
  ]);

  const leadDetailDirty = useMemo(() => {
    if (!selectedLead || !pipelineDraft) return false;
    return (
      pipelineDraft.status !== selectedLead.status ||
      drawerResolvedDealValue !== Number(selectedLead.value) ||
      (pipelineDraft.assignedToId || '') !== (selectedLead.assignedToId || '') ||
      (pipelineDraft.priority || '') !== (selectedLead.priority || '') ||
      (pipelineDraft.leadCategory || '') !== (selectedLead.leadCategory || '') ||
      (pipelineDraft.message || '') !== (selectedLead.message || '') ||
      (pipelineDraft.cmsPackageId || '') !== (selectedLead.cmsPackageId || '') ||
      !leadDetailsEqual(pipelineDraft.details, pickLeadDetails(selectedLead))
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

  const selectedLeadIntake = useMemo(() => {
    if (!selectedLeadId) return null;
    return findLeadIntakeNote(leadNotes.filter((n) => n.leadId === selectedLeadId));
  }, [selectedLeadId, leadNotes]);

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
          cmsPackageId: selectedLead.cmsPackageId,
          priority: selectedLead.priority,
          leadCategory: selectedLead.leadCategory,
          source: selectedLead.source ?? '',
          message: selectedLead.message ?? '',
          details: pickLeadDetails(selectedLead),
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
        const nextPriority = pipelineDraft.priority || undefined;
        const curPriority = selectedLead.priority ?? undefined;
        if (nextPriority !== curPriority) updates.priority = nextPriority;
        const nextCategory = pipelineDraft.leadCategory || undefined;
        const curCategory = selectedLead.leadCategory ?? undefined;
        if (nextCategory !== curCategory) updates.leadCategory = nextCategory;
        if ((pipelineDraft.message || '') !== (selectedLead.message || '')) {
          updates.message = pipelineDraft.message.trim() || undefined;
        }
        const nextPackage = pipelineDraft.cmsPackageId || undefined;
        const curPackage = selectedLead.cmsPackageId ?? undefined;
        if (nextPackage !== curPackage) {
          updates.cmsPackageId = nextPackage;
        }
        if (!leadDetailsEqual(pipelineDraft.details, pickLeadDetails(selectedLead))) {
          Object.assign(updates, pickLeadDetails(pipelineDraft.details));
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
          cmsPackageId: pipelineDraft.cmsPackageId,
          priority: pipelineDraft.priority,
          leadCategory: pipelineDraft.leadCategory,
          source: pipelineDraft.source ?? '',
          message: pipelineDraft.message ?? '',
          details: pickLeadDetails(pipelineDraft.details),
        });

        setSelectedLeadId(null);
      } finally {
        setSavingLead(false);
      }
    }, 'Lead saved');
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
  const [newPhoneCountryCode, setNewPhoneCountryCode] = useState(defaultCountryCode);
  const [newValue, setNewValue] = useState('');
  const [newSource, setNewSource] = useState('Website');
  const [newAssigned, setNewAssigned] = useState('');
  const [leadEntryMode, setLeadEntryMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [addIntakeCheck, setAddIntakeCheck] = useState<LeadIntakeCheckResult | null>(null);
  const [addIntakeCheckLoading, setAddIntakeCheckLoading] = useState(false);
  const [drawerIntakeCheck, setDrawerIntakeCheck] = useState<LeadIntakeCheckResult | null>(null);
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
    if (!selectedLead) {
      setDrawerIntakeCheck(null);
      return;
    }
    const email = selectedLead.email?.trim();
    const phone = selectedLead.phone?.trim();
    if (!email && !phone) {
      setDrawerIntakeCheck(null);
      return;
    }

    let cancelled = false;
    void checkLeadIntake({ email, phone, excludeLeadId: selectedLead.id })
      .then((result) => {
        if (!cancelled) setDrawerIntakeCheck(result);
      })
      .catch(() => {
        if (!cancelled) setDrawerIntakeCheck(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLead?.id, selectedLead?.email, selectedLead?.phone]);

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
    const found = itineraries.find(
      (i) => i.id === bookingItineraryId && i.agencyId === currentAgency.id,
    );
    if (found) return found;
    if (resumeItineraryPreview?.id === bookingItineraryId) {
      return {
        id: resumeItineraryPreview.id,
        agencyId: currentAgency.id,
        title: resumeItineraryPreview.title,
        totalPrice: resumeItineraryPreview.totalPrice,
        description: '',
        status: 'DRAFT' as const,
        markupMargin: 0,
        taxRate: 0,
        isTemplate: false,
        days: [],
      };
    }
    return undefined;
  }, [
    bookingItineraryId,
    bookableItineraries,
    itineraries,
    currentAgency.id,
    resumeItineraryPreview,
  ]);

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

  /** What the convert card will use: pre-built CMS package vs custom trip planner itinerary. */
  const crmBookingSource = useMemo(() => {
    const cmsPackageId = (pipelineDraft?.cmsPackageId || '').trim();
    const customItineraryId = (bookingItineraryId || '').trim();
    const persistedItineraryId =
      leadPackageMode === 'PRE_BUILT'
        ? ''
        : (selectedLead?.proposalItineraryId || '').trim();
    const itineraryId = customItineraryId || persistedItineraryId;

    if (leadPackageMode === 'PRE_BUILT') {
      return { kind: 'prebuilt' as const, cmsPackageId, itineraryId: '' };
    }
    if (leadPackageMode === 'CUSTOM') {
      return { kind: 'custom' as const, cmsPackageId: '', itineraryId };
    }
    if (cmsPackageId) {
      return { kind: 'prebuilt' as const, cmsPackageId, itineraryId: '' };
    }
    return { kind: 'custom' as const, cmsPackageId: '', itineraryId };
  }, [
    leadPackageMode,
    pipelineDraft?.cmsPackageId,
    bookingItineraryId,
    selectedLead?.proposalItineraryId,
  ]);

  const crmCanConvertToBooking = useMemo(() => {
    if (crmBookingSource.kind === 'prebuilt') {
      return Boolean(crmBookingSource.cmsPackageId);
    }
    return Boolean(crmBookingSource.itineraryId);
  }, [crmBookingSource]);

  useLayoutEffect(() => {
    /* Re-run whenever we land on this route so itinerary → CRM client navigations pick up STORAGE
       even if this page stayed warm in memory (empty deps misses that). */
    if (pathname !== '/dashboard/crm') return;
    if (typeof window === 'undefined') return;
    const resume = readCrmBookingResumeFromStorage();
    if (!resume) return;

    const { leadId: lid, itineraryId: iid, itineraryTitle, itineraryTotalPrice } = resume;

    /** Open the lead drawer after explicit Assign from Trip planner. */
    const resumeLeadSnap = leads.find(
      (l) => l.id === lid && l.agencyId === currentAgency.id,
    );
    if (
      resumeLeadSnap &&
      ((resumeLeadSnap.proposalItineraryId ?? '').trim() || '') !== iid
    ) {
      updateLeadExtras(lid, { proposalItineraryId: iid });
    }

    if (itineraryTitle) {
      setResumeItineraryPreview({
        id: iid,
        title: itineraryTitle,
        totalPrice:
          itineraryTotalPrice != null && Number.isFinite(itineraryTotalPrice)
            ? itineraryTotalPrice
            : 0,
      });
    }

    pendingBookingResumePickRef.current = { leadId: lid, itineraryId: iid };
    applyingCrmBookingResumeRef.current = true;
    setSelectedLeadId(lid);
    setBookingItineraryId(iid);
    void hydrateItineraryDetail(iid);
  }, [pathname, leads, currentAgency.id, updateLeadExtras, hydrateItineraryDetail]);

  useEffect(() => {
    if (!bookingItineraryId) {
      setResumeItineraryPreview(null);
      return;
    }
    void hydrateItineraryDetail(bookingItineraryId);
  }, [bookingItineraryId, hydrateItineraryDetail]);

  useEffect(() => {
    if (!bookingItineraryId) return;
    const hydrated = itineraries.find(
      (i) =>
        i.id === bookingItineraryId &&
        i.agencyId === currentAgency.id &&
        (i.days?.length ?? 0) > 0,
    );
    if (hydrated) setResumeItineraryPreview(null);
  }, [bookingItineraryId, itineraries, currentAgency.id]);

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
      crmToastInfo(
        'This traveller already has an unpaid or partially paid invoice in Billing. Record payment before creating another booking.',
      );
      return;
    }

    /** Directory profile is independent of conversion — bookings can exist before a traveller card exists */
    const cid = (effectiveCustomerId || '').trim();

    if (!crmCanConvertToBooking) {
      crmToastInfo(
        crmBookingSource.kind === 'prebuilt'
          ? 'Pick a pre-built package to convert to a booking.'
          : 'Pick an itinerary to attach to this booking.',
      );
      return;
    }

    if (!cid) {
      crmToastInfo('Link or create a customer profile before converting to a booking.');
      return;
    }

    creatingBookingRef.current = true;
    setCreatingBooking(true);

    void runLeadAction('Create booking', async () => {
      try {
        let itineraryId = '';
        let itineraryTitle = '';
        let itineraryAmount = 0;

        if (crmBookingSource.kind === 'prebuilt') {
          const apiItinerary = await createItineraryFromCmsPackage({
            cmsPackageId: crmBookingSource.cmsPackageId,
            customerId: cid,
          });
          itineraryId = apiItinerary.id;
          itineraryTitle = apiItinerary.title;
          itineraryAmount = Number(apiItinerary.total_price) || 0;
          updateLeadExtras(selectedLead.id, { proposalItineraryId: itineraryId });
        } else {
          itineraryId = crmBookingSource.itineraryId;
          const cached = itineraries.find(
            (i) => i.id === itineraryId && i.agencyId === currentAgency.id,
          );
          if (cached) {
            itineraryTitle = cached.title;
            itineraryAmount = Number(cached.totalPrice) || 0;
          } else {
            const apiItinerary = await getItinerary(itineraryId);
            const mapped = mapItineraryFromApi(apiItinerary);
            itineraryTitle = mapped.title;
            itineraryAmount = Number(mapped.totalPrice) || 0;
          }
        }

        const duplicate = bookings.some(
          (b) =>
            b.agencyId === currentAgency.id &&
            b.customerId === cid &&
            b.itineraryId === itineraryId,
        );
        if (duplicate) {
          crmToastInfo(
            'A booking already exists for this itinerary. Open Billing & ERP Finance for invoice details.',
          );
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
            amount: itineraryAmount,
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
          `Converted to booking on "${itineraryTitle}". Draft invoice${invNo ? ` ${invNo}` : ''} — ₹${invAmt.toLocaleString('en-IN')}${!draftedInvoice ? ' (see Billing)' : ''}. Record payments in Billing & ERP Finance.`,
          currentUser?.name ?? 'System',
        );
        await bookingNotePromise;

        if (!draftedInvoice) {
          crmToastInfo(
            'Booking created, but no draft invoice was generated. Check Billing if the invoice appears.',
          );
        }

        /** Close lead drawer and open Billing (invoices / Accounts Receivable is the default tab) */
        setSelectedLeadId(null);
        router.push('/dashboard/finance');
      } finally {
        creatingBookingRef.current = false;
        setCreatingBooking(false);
      }
    }, 'Booking created');
  };

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
          setSelectedLeadId(result.lead.id);
        }
      } finally {
        creatingLeadRef.current = false;
        setCreatingLead(false);
      }
    }, 'Lead saved');
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

    void promise
      .then(() => {
        crmToastSuccess('Note added');
      })
      .catch((error) => {
      setNoteContent(content);
      const message = error instanceof Error ? error.message : 'Add note failed';
      setActionError(message);
      crmToastError(message);
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

    void promise
      .then(() => {
        crmToastSuccess('Follow-up scheduled');
      })
      .catch((error) => {
      setFollowupDate(dateDraft);
      setFollowupNotes(notes);
      const message = error instanceof Error ? error.message : 'Schedule followup failed';
      setActionError(message);
      crmToastError(message);
    });
  };

  const handleStatusChange = (leadId: string, status: Lead['status']) => {
    void runLeadAction('Update status', async () => {
      await updateLeadStatus(leadId, status);
      if (leadId === selectedLeadId) {
        leadDetailServerStatusRef.current = status;
        setLeadDetailDraft((prev) => (prev ? { ...prev, status } : prev));
      }
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
                <th title="TRG###-XX — see abbreviation key below">Lead ID</th>
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
                  setSelectedLeadId(leadId);
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

      {/* Lead Details Drawer */}
      {selectedLead && pipelineDraft && (
        <div className="crm-lead-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="lead-drawer-title">
          <div className="crm-lead-drawer animate-scale-in">
            <header className="crm-lead-drawer__header">
              <div className="min-w-0 flex-1">
                <span
                  className="crm-lead-drawer__eyebrow"
                  title={leadCodeLegendHint(selectedLead.leadCode) ?? undefined}
                >
                  {formatLeadDisplayCode(selectedLead)}
                </span>
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

            {(drawerIntakeCheck?.existing_customer ||
              (drawerIntakeCheck?.duplicate_leads.length ?? 0) > 0) && (
              <div className="crm-lead-drawer__section px-5 pt-0">
                <LeadIntakeAlerts
                  check={drawerIntakeCheck}
                  compact
                  onOpenLead={(leadId) => setSelectedLeadId(leadId)}
                />
              </div>
            )}

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
                        Pipeline stage
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
                            : leadPackageMode === 'PRE_BUILT' && pipelineDraft.cmsPackageId
                              ? 'Total from selected CMS package'
                              : 'Attach an itinerary to sync total'
                        }
                        className="crm-lead-drawer__input"
                      />
                      <p className="crm-lead-drawer__hint">
                        {bookingItineraryId
                          ? 'Synced from itinerary total.'
                          : leadPackageMode === 'PRE_BUILT' && pipelineDraft.cmsPackageId
                            ? 'Synced from package price.'
                            : 'Select a package or itinerary below to populate.'}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor={`lead-priority-${selectedLead.id}`}
                        className="crm-lead-drawer__field-label"
                      >
                        Lead status
                      </label>
                      <select
                        id={`lead-priority-${selectedLead.id}`}
                        value={pipelineDraft.priority || ''}
                        onChange={(e) =>
                          setDrawerPipeline({
                            priority: (e.target.value || undefined) as Lead['priority'],
                          })
                        }
                        className="crm-lead-drawer__select"
                      >
                        <option value="">Not set</option>
                        {LEAD_PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`lead-category-${selectedLead.id}`}
                        className="crm-lead-drawer__field-label"
                      >
                        Lead category
                      </label>
                      <select
                        id={`lead-category-${selectedLead.id}`}
                        value={pipelineDraft.leadCategory || ''}
                        onChange={(e) =>
                          setDrawerPipeline({
                            leadCategory: (e.target.value || undefined) as Lead['leadCategory'],
                          })
                        }
                        className="crm-lead-drawer__select"
                      >
                        <option value="">Not set</option>
                        {LEAD_CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
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
                        readOnly
                        value={(pipelineDraft.source ?? selectedLead.source ?? '').trim() || 'Manual CRM input'}
                        className="crm-lead-drawer__input cursor-not-allowed bg-secondary/30"
                        tabIndex={-1}
                        aria-readonly="true"
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

                {selectedLeadIntake ? (
                  <LeadIntakeDetailsPanel intake={selectedLeadIntake} />
                ) : null}

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

                <LeadDetailsForm
                  leadId={selectedLead.id}
                  value={pipelineDraft.details}
                  onChange={(patch) => {
                    const nextDetails = { ...pipelineDraft.details, ...patch };
                    const drawerPatch: Partial<LeadDetailDraft> = { details: nextDetails };
                    if (patch.packageMode === 'CUSTOM') {
                      drawerPatch.cmsPackageId = undefined;
                    }
                    setDrawerPipeline(drawerPatch);
                    if (patch.packageMode === 'PRE_BUILT') {
                      pendingBookingResumePickRef.current = null;
                      setBookingItineraryId('');
                    }
                  }}
                />

                <section className="crm-lead-drawer__section crm-lead-drawer__booking">
                  <h3 className="crm-lead-drawer__booking-title">
                    <ClipboardList className="h-4 w-4 text-[var(--gold)]" aria-hidden />
                    Convert to booking &amp; invoice
                  </h3>
                  {showPrebuiltPackagePicker ? (
                    <>
                      <label className="crm-lead-drawer__field-label" htmlFor={`lead-package-${selectedLead.id}`}>
                        Proposal / package ({destinationPackages.packages.length})
                      </label>
                      <select
                        id={`lead-package-${selectedLead.id}`}
                        value={pipelineDraft.cmsPackageId ?? ''}
                        onChange={(e) => {
                          const nextPackageId = e.target.value || undefined;
                          setDrawerPipeline({
                            cmsPackageId: nextPackageId,
                            ...(nextPackageId
                              ? {
                                  details: {
                                    ...pipelineDraft.details,
                                    packageMode: 'PRE_BUILT',
                                  },
                                }
                              : {}),
                          });
                          if (nextPackageId) {
                            pendingBookingResumePickRef.current = null;
                            setBookingItineraryId('');
                            updateLeadExtras(selectedLead.id, { proposalItineraryId: undefined });
                          }
                        }}
                        className="crm-lead-drawer__select"
                        disabled={!destinationPackages.hasDestination && !pipelineDraft.cmsPackageId}
                      >
                        <option value="">
                          {destinationPackages.hasDestination
                            ? 'Choose package…'
                            : 'Enter destination in Details first…'}
                        </option>
                        {pipelineDraft.cmsPackageId &&
                        !destinationPackages.packages.some((p) => p.id === pipelineDraft.cmsPackageId) ? (
                          <option value={pipelineDraft.cmsPackageId}>
                            {selectedProposalPackage
                              ? `${selectedProposalPackage.title} · ${selectedProposalPackage.durationLabel} · ₹${selectedProposalPackage.price.toLocaleString('en-IN')}`
                              : 'Linked package…'}
                          </option>
                        ) : null}
                        {destinationPackages.packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.title} · {pkg.durationLabel} · ₹{pkg.price.toLocaleString('en-IN')}
                            {pkg.destinationName ? ` · ${pkg.destinationName}` : ''}
                            {!pkg.isPublished ? ' · Internal' : ''}
                          </option>
                        ))}
                      </select>
                      {destinationPackages.loading ? (
                        <p className="crm-lead-drawer__hint">Loading packages for “{destinationPackages.destinationQuery}”…</p>
                      ) : null}
                      {!destinationPackages.loading && destinationPackages.hasDestination && destinationPackages.packages.length === 0 ? (
                        <p className="crm-lead-drawer__hint">
                          No CMS packages match “{destinationPackages.destinationQuery}”. Try the exact destination name or check the Packages catalog.
                        </p>
                      ) : null}
                      {!destinationPackages.hasDestination ? (
                        <p className="crm-lead-drawer__hint">
                          Set Destination in Details above — this list shows all CMS packages for that place.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {showTripPlannerPicker ? (
                    <>
                      <label
                        className={`crm-lead-drawer__field-label${showPrebuiltPackagePicker ? ' mt-3' : ''}`}
                        htmlFor={`lead-itin-${selectedLead.id}`}
                      >
                        Trip planner itinerary ({bookableItineraries.length})
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
                          if (v) {
                            setDrawerPipeline({
                              cmsPackageId: undefined,
                              details: {
                                ...pipelineDraft.details,
                                packageMode: 'CUSTOM',
                              },
                            });
                          }
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
                      {bookableItineraries.length === 0 && !bookingItineraryId ? (
                        <p className="crm-lead-drawer__hint">Add days to a trip on the Trip planner page to convert to a booking.</p>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      !crmCanConvertToBooking ||
                      hasOutstandingInvoiceForLeadTraveller ||
                      creatingBooking
                    }
                    title={
                      creatingBooking
                        ? 'Creating booking and invoice…'
                        : !crmCanConvertToBooking
                          ? crmBookingSource.kind === 'prebuilt'
                            ? 'Choose a pre-built package first'
                            : 'Choose a proposal itinerary first'
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
                      <DatePickerInput
                        required
                        value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="max-w-[12rem]"
                        inputClassName="crm-lead-drawer__composer-input"
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
                    }, 'Lead deleted');
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
