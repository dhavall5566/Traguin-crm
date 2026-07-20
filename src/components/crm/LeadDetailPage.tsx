'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useStore, Lead } from '@/lib/store';
import { useLeadsPage } from '@/hooks/useLeadsPage';
import { useItineraryPage } from '@/hooks/useItineraryPage';
import { useBookingsInvoices } from '@/hooks/useBookingsInvoices';
import { createBooking as createBookingApi, mapBookingFromApi } from '@/lib/api/bookings';
import { createInvoice, mapInvoiceFromApi } from '@/lib/api/finance';
import { getLead } from '@/lib/api/leads';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  LeadTimelineActivityBody,
  LeadTimelineNoteBody,
} from '@/components/crm/LeadTimelineContent';
import { LeadIntakeDetailsPanel } from '@/components/crm/LeadIntakeDetailsPanel';
import { CustomerInquiryHistoryPanel } from '@/components/crm/CustomerInquiryHistoryPanel';
import {
  fetchLeadInquiryHistory,
  type CustomerInquiryHistory,
} from '@/lib/api/customer-inquiry';
import { findLeadIntakeNote } from '@/lib/lead-intake-display';
import { LeadTimelineAnimatedItem } from '@/components/crm/LeadTimelineAnimatedItem';
import { LeadDetailsForm } from '@/components/crm/LeadDetailsForm';
import { useCmsPackageSummary, usePackagesForDestination } from '@/hooks/usePackagesCatalog';
import {
  createItineraryFromCmsPackage,
  getItinerary,
  mapItineraryFromApi,
} from '@/lib/api/itineraries';
import {
  sortTimelineItems,
  isRedundantNoteActivity,
  dedupeAccidentalNotes,
  isPendingTimelineItem,
} from '@/lib/lead-timeline-format';
import { formatLeadDisplayCode, leadCodeLegendHint } from '@/lib/lead-codes';
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
  consumeCrmBookingResumeFromStorage,
} from '@/lib/crmItineraryHandoff';
import { useNavigateToLeadDetail } from '@/hooks/useNavigateToLeadDetail';
import { leaveLeadDetailPage } from '@/lib/crm-lead-navigation';
import { LEAD_PRIORITY_OPTIONS } from '@/lib/lead-priority';
import {
  LEAD_PIPELINE_STAGES,
  effectivePipelineStage,
  resolvePipelineStage,
  type LeadPipelineStatus,
} from '@/lib/lead-pipeline';
import {
  Activity,
  Trash2,
  Clock,
  ClipboardList,
  Save,
  Check,
  ArrowLeft,
} from 'lucide-react';

type LeadDetailDraft = Pick<
  Lead,
  'status' | 'value' | 'assignedToId' | 'cmsPackageId' | 'priority' | 'leadCategory'
> & {
  source: string;
  message: string;
  details: LeadDetailsFields;
};

const LEAD_CATEGORY_OPTIONS: { value: Lead['leadCategory']; label: string }[] = [
  { value: 'DOMESTIC', label: 'Domestic' },
  { value: 'INTERNATIONAL', label: 'International' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'VISA_ONLY', label: 'Visa Only' },
];

const stages = LEAD_PIPELINE_STAGES;

type DrawerTimelineEntry =
  | { kind: 'note'; id: string; at: string; author: string; content: string }
  | { kind: 'activity'; id: string; at: string; author: string; description: string }
  | { kind: 'followup'; id: string; at: string; scheduledAt: string; notes: string };

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigateToLead = useNavigateToLeadDetail();
  const {
    leads,
    leadNotes,
    leadActivities,
    leadFollowups,
    staff,
    hydrateLeadDetail,
    hydratingLeadId,
    upsertLeadFromApi,
    updateLeadStatus,
    updateLead,
    updateLeadExtras,
    deleteLead,
    addLeadNote,
    addLeadFollowup,
  } = useLeadsPage();

  const [deferCatalogLoads, setDeferCatalogLoads] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.requestIdleCallback(() => setDeferCatalogLoads(true), { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }, []);

  const { itineraries, hydrateItineraryDetail } = useItineraryPage({ enabled: deferCatalogLoads });
  const { bookings, invoices, refresh: refreshBookingsInvoices } = useBookingsInvoices({
    enabled: deferCatalogLoads,
  });
  const { currentAgency, currentUser, workspacePreferences } = useStore();

  const [actionError, setActionError] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
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

  const selectedLead = useMemo(() => {
    return (
      leads.find((l) => l.id === leadId && l.agencyId === currentAgency.id) ?? null
    );
  }, [leads, leadId, currentAgency.id]);

  const leadBootstrapRef = useRef<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      leadBootstrapRef.current = null;
      return;
    }
    const exists = leads.some((l) => l.id === leadId && l.agencyId === currentAgency.id);
    if (!exists) {
      if (leadBootstrapRef.current === leadId) return;
      leadBootstrapRef.current = leadId;
      let cancelled = false;
      void getLead(leadId)
        .then((api) => {
          if (!cancelled) upsertLeadFromApi(api);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    leadBootstrapRef.current = null;
    void hydrateLeadDetail(leadId);
  }, [leadId, leads, currentAgency.id, hydrateLeadDetail, upsertLeadFromApi]);

  const [bookingItineraryId, setBookingItineraryId] = useState('');
  const applyingCrmBookingResumeRef = useRef(false);
  const bookingHydrationLeadRef = useRef<string | null>(null);
  const pendingBookingResumePickRef = useRef<{ leadId: string; itineraryId: string } | null>(
    null,
  );

  const [leadDetailDraft, setLeadDetailDraft] = useState<LeadDetailDraft | null>(null);
  const leadDetailHydratedForIdRef = useRef<string | null>(null);
  const leadDetailServerStatusRef = useRef<string | null>(null);
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
    if (!leadId) {
      leadDetailHydratedForIdRef.current = null;
      setLeadDetailDraft(null);
      return;
    }
    const snap = leads.find((l) => l.id === leadId && l.agencyId === currentAgency.id);
    if (!snap) return;
    if (leadDetailHydratedForIdRef.current !== leadId) {
      leadDetailHydratedForIdRef.current = leadId;
      leadDetailServerStatusRef.current = snap.status;
      leadDetailServerAssignRef.current = snap.assignedToId ?? undefined;
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
    const prevServerAssign = leadDetailServerAssignRef.current ?? undefined;
    const nextServerAssign = snap.assignedToId ?? undefined;

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
        const trackedAssign = prevServerAssign;
        const serverAssign = nextServerAssign;
        if (draftAssign === trackedAssign && draftAssign !== serverAssign) {
          next = { ...next, assignedToId: snap.assignedToId };
        }
        return next;
      });
    }
    leadDetailServerStatusRef.current = snap.status;
    leadDetailServerAssignRef.current = nextServerAssign;
  }, [leadId, leads, currentAgency.id]);

  const pipelineDraft: LeadDetailDraft | null = useMemo(() => {
    if (!selectedLead || !leadId) return null;
    const draftReadyForThisCard =
      leadDetailDraft != null && leadDetailHydratedForIdRef.current === leadId;
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
  }, [selectedLead, leadId, leadDetailDraft]);

  const destinationPackages = usePackagesForDestination(pipelineDraft?.details.travelDestination);
  const { summary: selectedProposalPackage } = useCmsPackageSummary(pipelineDraft?.cmsPackageId);
  const leadPackageMode =
    pipelineDraft?.details.packageMode ??
    (pipelineDraft?.cmsPackageId ? 'PRE_BUILT' : bookingItineraryId ? 'CUSTOM' : undefined);
  const showPrebuiltPackagePicker = leadPackageMode !== 'CUSTOM';
  const showTripPlannerPicker = leadPackageMode !== 'PRE_BUILT';

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

  const displayPipelineStage = useMemo(() => {
    if (!selectedLead || !pipelineDraft) return 'NEW' as LeadPipelineStatus;
    return effectivePipelineStage(pipelineDraft.status, {
      status: selectedLead.status,
      assignedToId: selectedLead.assignedToId,
      assignmentStatus: selectedLead.assignmentStatus,
      proposalSentAt: selectedLead.proposalSentAt,
      activities: leadActivities.filter((activity) => activity.leadId === leadId),
      followups: leadFollowups.filter((followup) => followup.leadId === leadId),
    });
  }, [
    selectedLead,
    pipelineDraft,
    leadActivities,
    leadFollowups,
    leadId,
  ]);

  const drawerPipelineStageIdx = useMemo(() => {
    const i = stages.findIndex((s) => s.id === displayPipelineStage);
    return i >= 0 ? i : 0;
  }, [displayPipelineStage]);

  const drawerTimeline = useMemo((): DrawerTimelineEntry[] => {
    if (!leadId) return [];
    const entries: DrawerTimelineEntry[] = [
      ...dedupeAccidentalNotes(leadNotes.filter((n) => n.leadId === leadId)).map((n) => ({
        kind: 'note' as const,
        id: n.id,
        at: n.createdAt,
        author: n.createdBy,
        content: n.content,
      })),
      ...leadActivities
        .filter((a) => a.leadId === leadId)
        .filter((a) => !isRedundantNoteActivity(a.description))
        .map((a) => ({
          kind: 'activity' as const,
          id: a.id,
          at: a.createdAt,
          author: a.createdBy,
          description: a.description,
        })),
      ...leadFollowups
        .filter((f) => f.leadId === leadId)
        .map((f) => ({
          kind: 'followup' as const,
          id: f.id,
          at: f.scheduledAt,
          scheduledAt: f.scheduledAt,
          notes: f.notes ?? '',
        })),
    ];
    return sortTimelineItems(entries);
  }, [leadId, leadNotes, leadActivities, leadFollowups]);

  const selectedLeadIntake = useMemo(() => {
    if (!leadId) return null;
    return findLeadIntakeNote(leadNotes.filter((n) => n.leadId === leadId));
  }, [leadId, leadNotes]);

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [drawerTimeline, leadId]);

  useEffect(() => {
    if (timelineEnterTick === 0) return;
    const el = timelineScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [timelineEnterTick]);

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
      } finally {
        setSavingLead(false);
      }
    }, 'Lead saved');
  };

  const requestCloseLeadPage = () => {
    if (leadDrawerDirty) {
      const ok = typeof window !== 'undefined' &&
        window.confirm('You have unsaved changes. Leave without saving?');
      if (!ok) return;
    }
    leaveLeadDetailPage(router);
  };

  const [drawerInquiryHistory, setDrawerInquiryHistory] = useState<CustomerInquiryHistory | null>(null);
  const [drawerInquiryHistoryLoading, setDrawerInquiryHistoryLoading] = useState(false);
  const [drawerDetailsLoading, setDrawerDetailsLoading] = useState(false);
  const [drawerInteractionsLoading, setDrawerInteractionsLoading] = useState(false);
  const inquiryDetailsLoadedRef = useRef(false);

  useEffect(() => {
    if (!leadId) {
      setDrawerInquiryHistory(null);
      inquiryDetailsLoadedRef.current = false;
      return;
    }

    let cancelled = false;
    inquiryDetailsLoadedRef.current = false;
    setDrawerInquiryHistoryLoading(true);

    void fetchLeadInquiryHistory(leadId, {
      includeInteractions: false,
      includeDetails: false,
    })
      .then((result) => {
        if (!cancelled) setDrawerInquiryHistory(result);
      })
      .catch(() => {
        if (!cancelled) setDrawerInquiryHistory(null);
      })
      .finally(() => {
        if (!cancelled) setDrawerInquiryHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const loadInquiryDetails = useCallback(() => {
    if (!leadId || inquiryDetailsLoadedRef.current) return;
    inquiryDetailsLoadedRef.current = true;
    setDrawerDetailsLoading(true);
    setDrawerInteractionsLoading(true);
    void fetchLeadInquiryHistory(leadId, {
      includeInteractions: true,
      includeDetails: true,
    })
      .then((result) => setDrawerInquiryHistory(result))
      .catch(() => {
        inquiryDetailsLoadedRef.current = false;
      })
      .finally(() => {
        setDrawerDetailsLoading(false);
        setDrawerInteractionsLoading(false);
      });
  }, [leadId]);

  const refreshInquiryHistory = () => {
    if (!leadId) return;
    inquiryDetailsLoadedRef.current = true;
    setDrawerDetailsLoading(true);
    setDrawerInteractionsLoading(true);
    void fetchLeadInquiryHistory(leadId, {
      includeInteractions: true,
      includeDetails: true,
    })
      .then(setDrawerInquiryHistory)
      .finally(() => {
        setDrawerDetailsLoading(false);
        setDrawerInteractionsLoading(false);
      });
  };

  const [noteContent, setNoteContent] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');

  const effectiveCustomerId = selectedLead?.customerId;

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
    if (pathname !== `/dashboard/crm/leads/${leadId}`) return;
    if (typeof window === 'undefined') return;
    const resume = consumeCrmBookingResumeFromStorage();
    if (!resume || resume.leadId !== leadId) return;

    const { itineraryId: iid, itineraryTitle, itineraryTotalPrice } = resume;

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

    pendingBookingResumePickRef.current = { leadId, itineraryId: iid };
    applyingCrmBookingResumeRef.current = true;
    setBookingItineraryId(iid);
    void hydrateItineraryDetail(iid);
  }, [pathname, leadId, hydrateItineraryDetail]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(STORAGE_CRM_RESUME_BOOKING);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { leadId?: string; itineraryId?: string };
      const lid = typeof parsed.leadId === 'string' ? parsed.leadId.trim() : '';
      const iid = typeof parsed.itineraryId === 'string' ? parsed.itineraryId.trim() : '';
      if (!lid || !iid || lid !== leadId || iid !== bookingItineraryId) return;
      sessionStorage.removeItem(STORAGE_CRM_RESUME_BOOKING);
    } catch {
      /* ignore malformed storage */
    }
  }, [leadId, bookingItineraryId]);

  useEffect(() => {
    const p = pendingBookingResumePickRef.current;
    if (!p || !leadId) return;
    if (p.leadId !== leadId) return;
    if (
      itineraries.some((i) => i.id === p.itineraryId && i.agencyId === currentAgency.id)
    ) {
      pendingBookingResumePickRef.current = null;
    }
  }, [itineraries, currentAgency.id, leadId]);

  useEffect(() => {
    if (applyingCrmBookingResumeRef.current) {
      applyingCrmBookingResumeRef.current = false;
      if (leadId) {
        bookingHydrationLeadRef.current = leadId;
      }
      return;
    }
    if (!leadId) {
      bookingHydrationLeadRef.current = null;
      pendingBookingResumePickRef.current = null;
      setBookingItineraryId('');
      return;
    }
    if (!selectedLead || selectedLead.id !== leadId) return;

    const persisted = selectedLead.proposalItineraryId ?? '';
    const leadBucketChanged = bookingHydrationLeadRef.current !== leadId;

    if (leadBucketChanged) {
      bookingHydrationLeadRef.current = leadId;
      pendingBookingResumePickRef.current = null;
      setBookingItineraryId((prev) => (prev === persisted ? prev : persisted));
      return;
    }

    if (persisted) {
      setBookingItineraryId((prev) => (prev === persisted ? prev : persisted));
      return;
    }

    setBookingItineraryId((prev) => {
      const pending = pendingBookingResumePickRef.current;
      const matchesResume =
        !!pending &&
        pending.leadId === leadId &&
        !!prev &&
        pending.itineraryId === prev;
      const prevValid =
        !!prev &&
        (itineraries.some((i) => i.id === prev && i.agencyId === currentAgency.id) ||
          matchesResume);
      return prevValid ? prev : '';
    });
  }, [
    leadId,
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

        await updateLeadStatus(selectedLead.id, 'BOOKED');
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

        router.push('/dashboard/finance');
      } finally {
        creatingBookingRef.current = false;
        setCreatingBooking(false);
      }
    }, 'Booking created');
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
        refreshInquiryHistory();
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
        refreshInquiryHistory();
      })
      .catch((error) => {
        setFollowupDate(dateDraft);
        setFollowupNotes(notes);
        const message = error instanceof Error ? error.message : 'Schedule followup failed';
        setActionError(message);
        crmToastError(message);
      });
  };

  if (!selectedLead || !pipelineDraft) {
    const isHydrating = hydratingLeadId === leadId || (leads.length === 0 && !selectedLead);
    return (
      <div className="crm-lead-detail-page">
        <div className="crm-lead-detail-page__shell">
          <div className="crm-lead-detail-page__header">
            <button
              type="button"
              onClick={() => leaveLeadDetailPage(router)}
              className="crm-lead-detail-page__back-btn"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="crm-lead-detail-page__header-main">
              <p className="crm-lead-detail-page__meta">
                {isHydrating ? 'Loading lead…' : 'Lead not found or no longer in this workspace.'}
              </p>
            </div>
          </div>
          {!isHydrating ? (
            <div className="mt-2">
              <Link href="/dashboard/crm" className="crm-lead-detail-page__back-link">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to leads
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="crm-lead-detail-page">
      {actionError && (
        <div className="crm-lead-detail-page__alert crm-alert-warning">{actionError}</div>
      )}

      <div className="crm-lead-detail-page__shell">
        <header className="crm-lead-detail-page__header">
          <button
            type="button"
            onClick={requestCloseLeadPage}
            className="crm-lead-detail-page__back-btn"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>

          <div className="crm-lead-detail-page__header-main">
            <div className="crm-lead-detail-page__header-top">
              <span
                className="crm-lead-detail-page__code"
                title={leadCodeLegendHint(selectedLead.leadCode) ?? undefined}
              >
                {formatLeadDisplayCode(selectedLead)}
              </span>
            </div>
            <h1 className="crm-lead-detail-page__title">{selectedLead.title}</h1>
            <p className="crm-lead-detail-page__meta">
              {selectedLead.firstName} {selectedLead.lastName}
              {selectedLead.email ? ` · ${selectedLead.email}` : ''}
              {selectedLead.phone ? ` · ${selectedLead.phone}` : ''}
            </p>
          </div>
        </header>

        <div className="crm-lead-detail__customer-history">
          <CustomerInquiryHistoryPanel
            key={selectedLead.id}
            history={drawerInquiryHistory}
            loading={drawerInquiryHistoryLoading}
            detailsLoading={drawerDetailsLoading}
            interactionsLoading={drawerInteractionsLoading}
            onExpand={loadInquiryDetails}
            currentLeadId={selectedLead.id}
            onOpenLead={navigateToLead}
            hintReturningCustomer={Boolean(selectedLead.customerId)}
            contact={{
              firstName: selectedLead.firstName,
              lastName: selectedLead.lastName,
              email: selectedLead.email ?? undefined,
              phone: selectedLead.phone ?? undefined,
            }}
          />
        </div>

        <section
          className="crm-lead-detail-page__stage-card"
          aria-label="Pipeline stage progress"
        >
          <div className="crm-lead-detail-page__stage-head">
            <h2 className="crm-lead-detail-page__section-label">Stage progress</h2>
            <span className="crm-lead-detail-page__stage-summary">
              {stages[drawerPipelineStageIdx]?.name ?? displayPipelineStage}
              <span className="crm-lead-detail-page__stage-count">
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
                isCurrent && st.id === 'DUMP_LEAD' ? 'crm-lead-drawer__step--lost' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <React.Fragment key={st.id}>
                  <button
                    type="button"
                    className={stepClasses}
                    title={`Set stage to ${st.name}`}
                    onClick={() => setDrawerPipeline({ status: st.id })}
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

        <div className="crm-lead-detail-page__grid">
          <div className="crm-lead-detail-page__main">
            <section className="crm-lead-detail-page__card">
              <h2 className="crm-lead-detail-page__section-label">Pipeline fields</h2>
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
                      setDrawerPipeline({ status: e.target.value as LeadPipelineStatus })
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

            {selectedLeadIntake ? (
              <LeadIntakeDetailsPanel intake={selectedLeadIntake} />
            ) : null}

            <section className="crm-lead-detail-page__card">
              <h2 className="crm-lead-detail-page__section-label">Message</h2>
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

            <section className="crm-lead-detail-page__card crm-lead-drawer__booking">
              <h2 className="crm-lead-detail-page__section-label crm-lead-drawer__booking-title">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Convert to booking &amp; invoice
              </h2>
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

          <aside className="crm-lead-detail-page__aside">
            <div className="crm-lead-detail-page__aside-head">
              <span className="crm-lead-detail-page__section-label">
                <Activity className="h-4 w-4" aria-hidden />
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
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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

        <footer className="crm-lead-detail-page__footer">
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete lead record permanently?')) {
                void runLeadAction('Delete lead', async () => {
                  await deleteLead(selectedLead.id);
                  router.push('/dashboard/crm');
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
  );
}
