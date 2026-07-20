'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, Itinerary, ItineraryItem } from '@/lib/store';
import { useItineraryPage } from '@/hooks/useItineraryPage';
import { useBookingsInvoices } from '@/hooks/useBookingsInvoices';
import { getLead, mergeLeadExtras } from '@/lib/api/leads';
import { computeItineraryTotalPrice, newLocalId, resolveClientTotal } from '@/lib/api/itineraries';
import { invalidateCrmListCache } from '@/lib/api/crm-list-cache';
import { CRM_CACHE } from '@/lib/api/crm-workspace-store';
import {
  CrmItineraryCreationIntent,
  STORAGE_CRM_RESUME_BOOKING,
  clearCrmItineraryCreationIntentFromStorage,
  readCrmItineraryCreationIntentFromStorage,
} from '@/lib/crmItineraryHandoff';
import ClientProposalView from '@/components/proposal/ClientProposalView';
import DraftProposalEditor from '@/components/proposal/DraftProposalEditor';
import ClientTotalBadge from '@/components/itinerary/ClientTotalBadge';
import ClientPricingPanel from '@/components/itinerary/ClientPricingPanel';
import ItineraryRailCard from '@/components/itinerary/ItineraryRailCard';
import {
  buildProposalShareUrl,
  DEFAULT_PROPOSAL_THEME,
} from '@/lib/proposalThemes';
import {
  Compass,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  Share2,
  X,
  ChevronDown,
  Save,
  Wand2,
  Pencil,
  Calendar,
  Search,
} from 'lucide-react';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { AI_ITINERARY_MARKUP, AI_ITINERARY_TAX, buildAiItineraryDraft } from '@/lib/ai-itinerary-pricing';
import { pickPackageBenchmark } from '@/lib/ai-package-benchmark';
import { getCmsPackageFilters, listCmsPackages, mapPackageListFromApi } from '@/lib/api/packages';
import {
  stripItineraryPriceMentions,
  extractItineraryHub,
  parseDayExploreTitle,
  splitActivityDisplayTitle,
} from '@/lib/itinerary-display';
import { validateTripBriefForItinerary, findPlaceInTripBrief } from '@/lib/trip-destination-validation';
import {
  crmToastConfirm,
  crmToastError,
  crmToastInfo,
  crmToastSuccess,
} from '@/lib/crm-toast-bus';
import { isAgencyAdmin } from '@/lib/rbac';
import './itinerary-workspace.css';

const TRAVEL_STYLE_OPTIONS = [
  'Balanced',
  'Luxury',
  'Budget',
  'Adventure',
  'Family',
  'Culinary',
  'Relaxation',
] as const;

const AI_DAY_THEME_TEMPLATES = [
  'Arrival & Orientation',
  'City Highlights',
  'Nature & Viewpoints',
  'Culture & Museums',
  'Neighborhood Gems',
  'Adventure Track',
  'Wellness Day',
  'Farewell Moments',
];

function itineraryPlaceFromTitle(title: string): string | null {
  const aiMatch = title.match(/^AI:\s*(.+?)\s+\d+\s*-?\s*Day\b/i);
  if (aiMatch?.[1]?.trim()) return aiMatch[1].trim();
  return findPlaceInTripBrief(title, []);
}

export default function ItineraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAgency = useStore((state) => state.currentAgency);
  const currentUser = useStore((state) => state.currentUser);
  const isAdmin = isAgencyAdmin(currentUser?.role ?? '');
  const { bookings } = useBookingsInvoices();
  const {
    itineraries,
    customers,
    loading: itinerariesLoading,
    error: itinerariesError,
    dirtyIds,
    addItinerary,
    deleteItinerary,
    updateItinerary,
    saveItinerary,
    addItineraryDay,
    updateItineraryDay,
    deleteItineraryDay,
    addItineraryItem,
    updateItineraryItem,
    deleteItineraryItem,
    hydrateItineraryDetail,
  } = useItineraryPage();

  const [savingItinerary, setSavingItinerary] = useState(false);

  const agencyItineraries = useMemo(
    () => itineraries.filter((i) => i.agencyId === currentAgency.id),
    [itineraries, currentAgency.id]
  );
  const agencyCustomers = useMemo(
    () => customers.filter((c) => c.agencyId === currentAgency.id),
    [customers, currentAgency.id]
  );

  // States
  const [selectedItinId, setSelectedItinId] = useState('');
  const [showAddItinModal, setShowAddItinModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState<{ dayId: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDestination, setAiDestination] = useState('');
  const [aiNumDays, setAiNumDays] = useState<number | ''>('');
  const [aiTravelStyle, setAiTravelStyle] = useState('');

  /** When set via CRM dropdown “Create itinerary”, persist until a new itinerary is created or cancelled */
  const [crmItineraryIntent, setCrmItineraryIntent] = useState<CrmItineraryCreationIntent | null>(null);
  const crmItineraryIntentRef = useRef<CrmItineraryCreationIntent | null>(null);

  /** Inline edit: reuse add-item modal */
  const [editingItemCtx, setEditingItemCtx] = useState<{
    dayId: string;
    item: ItineraryItem;
  } | null>(null);

  // Add Itinerary form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCustId, setNewCustId] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  // Add Itinerary Item form
  const [itemType, setItemType] = useState<ItineraryItem['type']>('HOTEL');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDetails, setItemDetails] = useState('');

  const resolveCrmCustomerId = useCallback(
    async (intent: CrmItineraryCreationIntent | null | undefined) => {
      const fromIntent = intent?.customerId?.trim();
      if (fromIntent) return fromIntent;
      const leadId = intent?.leadId?.trim();
      if (!leadId) return undefined;
      try {
        const lead = await getLead(leadId);
        return lead.customer_id ?? undefined;
      } catch {
        return undefined;
      }
    },
    [],
  );

  useEffect(() => {
    crmItineraryIntentRef.current = crmItineraryIntent;
  }, [crmItineraryIntent]);

  /** Resolve linked customer from lead API when CRM handoff omits customerId */
  useEffect(() => {
    if (!crmItineraryIntent?.leadId || crmItineraryIntent.customerId?.trim()) return;
    void getLead(crmItineraryIntent.leadId).then((lead) => {
      const cid = lead.customer_id?.trim();
      if (!cid) return;
      setCrmItineraryIntent((prev) => {
        if (!prev?.leadId || prev.customerId?.trim()) return prev;
        return { ...prev, customerId: cid };
      });
      setNewCustId(cid);
    });
  }, [crmItineraryIntent]);

  /** Landing from CRM: hydrate intent from session — do NOT remove storage here (React Strict Mode
   *  remounts would lose it; finishing the flow calls clearCrmItineraryCreationIntentFromStorage).
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const intent = readCrmItineraryCreationIntentFromStorage();
      if (!intent) return;

      crmItineraryIntentRef.current = intent;
      setCrmItineraryIntent(intent);
      const cust = intent.customerId?.trim();
      if (cust) setNewCustId(cust);

      /* Clear stale selection — avoid pinning an unrelated existing trip while CRM intent is open. */
      setSelectedItinId('');
    } catch {
      clearCrmItineraryCreationIntentFromStorage();
    }
  }, []);

  const exitCrmItineraryContext = useCallback(() => {
    clearCrmItineraryCreationIntentFromStorage();
    crmItineraryIntentRef.current = null;
    setCrmItineraryIntent(null);
  }, []);

  const persistCrmProposalToLead = useCallback(
    (
      newItineraryId: string,
      resumeMeta?: { title?: string; totalPrice?: number },
    ) => {
      let intent = crmItineraryIntentRef.current;
      if (!intent?.leadId) intent = readCrmItineraryCreationIntentFromStorage();
      if (!intent?.leadId) return false;

      mergeLeadExtras(intent.leadId, { proposalItineraryId: newItineraryId });

      try {
        sessionStorage.setItem(
          STORAGE_CRM_RESUME_BOOKING,
          JSON.stringify({
            leadId: intent.leadId,
            itineraryId: newItineraryId,
            itineraryTitle: resumeMeta?.title?.trim() || undefined,
            itineraryTotalPrice:
              resumeMeta?.totalPrice != null && Number.isFinite(resumeMeta.totalPrice)
                ? resumeMeta.totalPrice
                : undefined,
          }),
        );
      } catch {
        /* resume marker optional — proposal already on lead extras */
      }
      return true;
    },
    [],
  );

  const assignItineraryToCrmLead = useCallback(
    (itinerary: Pick<Itinerary, 'id' | 'title' | 'totalPrice'>) => {
      if (
        !persistCrmProposalToLead(itinerary.id, {
          title: itinerary.title,
          totalPrice: Number(itinerary.totalPrice),
        })
      ) {
        return false;
      }
      invalidateCrmListCache(CRM_CACHE.itineraries);
      clearCrmItineraryCreationIntentFromStorage();
      crmItineraryIntentRef.current = null;
      setCrmItineraryIntent(null);
      router.push('/dashboard/crm');
      return true;
    },
    [router, persistCrmProposalToLead],
  );

  const handleDeleteSidebarItinerary = useCallback(
    (itin: Itinerary, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const doomedBookings = bookings.filter(
        (b) => b.agencyId === itin.agencyId && b.itineraryId === itin.id,
      );
      const msg =
        doomedBookings.length > 0
          ? `Delete “${itin.title}”? This also removes ${doomedBookings.length} linked booking(s) and their invoices.`
          : `Delete “${itin.title}”? This cannot be undone.`;

      crmToastConfirm(msg, {
        confirmLabel: 'Delete',
        onConfirm: async () => {
          try {
            await deleteItinerary(itin.id);
            if (selectedItinId === itin.id) setSelectedItinId('');
            crmToastSuccess(`“${itin.title}” deleted`);
          } catch (err) {
            crmToastError(err instanceof Error ? err.message : 'Failed to delete itinerary');
          }
        },
      });
    },
    [bookings, deleteItinerary, selectedItinId],
  );
  // Keep selected plan in sync — but while a CRM draft handoff is waiting, leave selection empty instead
  // of auto-opening an unrelated trip.
  useEffect(() => {
    const pendingCrmIntent =
      crmItineraryIntent ??
      crmItineraryIntentRef.current ??
      readCrmItineraryCreationIntentFromStorage();
    const openPlan = searchParams.get('openPlan')?.trim();

    if (agencyItineraries.length === 0) {
      if (selectedItinId) setSelectedItinId('');
      return;
    }

    if (openPlan && agencyItineraries.some((i) => i.id === openPlan)) {
      setSelectedItinId(openPlan);
      router.replace('/dashboard/itinerary', { scroll: false });
      return;
    }

    const hasMatch = !!(selectedItinId && agencyItineraries.some((i) => i.id === selectedItinId));
    if (hasMatch) return;
    if (pendingCrmIntent?.leadId) return;
    setSelectedItinId(agencyItineraries[0].id);
  }, [agencyItineraries, selectedItinId, crmItineraryIntent, searchParams, router]);

  useEffect(() => {
    if (!selectedItinId) return;
    void hydrateItineraryDetail(selectedItinId).then((record) => {
      if (record === null) {
        setSelectedItinId('');
        crmToastInfo('That itinerary is no longer available.');
      }
    });
  }, [selectedItinId, hydrateItineraryDetail]);

  /** Derive from `itineraries` (already subscribed above) so edits to days always re-render reliably. */
  const activeItinerary = useMemo(
    () =>
      itineraries.find((i) => i.id === selectedItinId && i.agencyId === currentAgency.id) ?? undefined,
    [itineraries, selectedItinId, currentAgency.id],
  );
  const clientProfile = agencyCustomers.find(c => c.id === activeItinerary?.customerId);
  const proposalTheme = DEFAULT_PROPOSAL_THEME;
  const clientName = clientProfile
    ? `${clientProfile.firstName} ${clientProfile.lastName}`
    : undefined;

  const shareUrl =
    typeof window !== 'undefined' && activeItinerary
      ? buildProposalShareUrl(window.location.origin, activeItinerary.id, proposalTheme)
      : activeItinerary
        ? buildProposalShareUrl('', activeItinerary.id, proposalTheme)
        : '';

  const itemModalDay =
    activeItinerary && showAddItemModal
      ? (activeItinerary.days ?? []).find((d) => d.id === showAddItemModal.dayId)
      : undefined;

  const destinationHub = activeItinerary
    ? extractItineraryHub(activeItinerary) ||
      parseDayExploreTitle(activeItinerary.days?.[0]?.title ?? '').city ||
      ''
    : '';

  const handleCreateItin = async (e: React.FormEvent) => {
    e.preventDefault();

    const mergedCrmIntent =
      crmItineraryIntent ??
      crmItineraryIntentRef.current ??
      readCrmItineraryCreationIntentFromStorage();
    const crmCust = mergedCrmIntent?.customerId?.trim();
    const formCust = (newCustId ?? '').trim();
    const resolvedCustomer =
      crmCust || formCust || (await resolveCrmCustomerId(mergedCrmIntent)) || undefined;

    try {
      const created = await addItinerary({
        title: newTitle,
        description: newDesc,
        customerId: resolvedCustomer,
        startDate: newStartDate || undefined,
        endDate: newEndDate || undefined,
        status: 'DRAFT',
        totalPrice: 0,
        markupMargin: AI_ITINERARY_MARKUP,
        taxRate: AI_ITINERARY_TAX,
        isTemplate: false,
        days: [],
      });

      const newItinId = created.id;

      setNewTitle('');
      setNewDesc('');
      setNewCustId('');
      setNewStartDate('');
      setNewEndDate('');
      setShowAddItinModal(false);

      setSelectedItinId(newItinId);
      crmToastSuccess('Itinerary created');
    } catch (err) {
      crmToastError(err instanceof Error ? err.message : 'Failed to create itinerary');
    }
  };

  const cancelNewItineraryModal = () => {
    setShowAddItinModal(false);
    /* Keep CRM intent + STORAGE_CREATE_ITIN_FROM_CRM so the user can still AI-generate / return later */
  };

  /** Prefill itinerary title/description from CRM lead when in the CRM→builder round-trip */
  const openNewItineraryModal = () => {
    const intent =
      crmItineraryIntent ??
      crmItineraryIntentRef.current ??
      readCrmItineraryCreationIntentFromStorage();
    const inquiry = intent?.leadMessage?.trim();
    const goal = intent?.leadGoalTitle?.trim();
    setNewTitle(inquiry || goal || '');
    if (intent?.leadId) {
      void getLead(intent.leadId).then((lead) => {
        const msg = lead.message?.trim();
        if (msg) setNewTitle(msg);
        const namePart = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
        setNewDesc(
          namePart
            ? `Trip draft for ${namePart}${lead.email ? ` · ${lead.email}` : ''}`.trim()
            : '',
        );
        const cid = lead.customer_id?.trim();
        if (cid && !intent.customerId?.trim()) {
          setNewCustId(cid);
          setCrmItineraryIntent((prev) => {
            const base = prev ?? intent;
            return base.customerId?.trim()
              ? { ...base, leadMessage: msg || base.leadMessage }
              : { ...base, customerId: cid, leadMessage: msg || base.leadMessage };
          });
        } else if (msg && !inquiry) {
          setNewTitle(msg);
          setCrmItineraryIntent((prev) => {
            const base = prev ?? intent;
            return { ...base, leadMessage: msg };
          });
        }
      });
    }
    setShowAddItinModal(true);
  };

  const openAiModalForCurrentContext = () => {
    setAiDestination('');
    setAiNumDays('');
    setAiTravelStyle('');
    setShowAiModal(true);
  };

  const handleAddDay = () => {
    if (!activeItinerary) return;

    const dayNum = (activeItinerary.days?.length ?? 0) + 1;
    const newDayId = addItineraryDay(
      activeItinerary.id,
      `Day ${dayNum}: Tour Schedule`,
      '',
    );
    void newDayId;
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItinerary || !showAddItemModal) return;

    if (
      editingItemCtx &&
      editingItemCtx.dayId === showAddItemModal.dayId
    ) {
      updateItineraryItem(
        activeItinerary.id,
        editingItemCtx.dayId,
        editingItemCtx.item.id,
        {
          type: itemType,
          title: itemTitle,
          details: stripItineraryPriceMentions(itemDetails),
          costPrice: editingItemCtx.item.costPrice,
          sellingPrice: editingItemCtx.item.sellingPrice,
        }
      );
    } else {
      addItineraryItem(activeItinerary.id, showAddItemModal.dayId, {
        type: itemType,
        title: itemTitle,
        details: stripItineraryPriceMentions(itemDetails),
        costPrice: 0,
        sellingPrice: 0,
      });
    }

    setItemTitle('');
    setItemDetails('');
    setEditingItemCtx(null);
    setShowAddItemModal(null);
  };

  /** Synthetic multi-day blueprint: always creates a new itinerary row and selects it in the sidebar. */
  const handleAiModalGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const tripBrief = aiDestination.trim();
    if (!tripBrief) {
      crmToastError('Please describe your destination or trip details.');
      return;
    }
    if (tripBrief.length < 3) {
      crmToastError('Add a bit more detail so the AI can build a useful itinerary.');
      return;
    }

    const styleLabel = aiTravelStyle;

    if (aiNumDays === '') {
      crmToastError('Please enter the number of days.');
      return;
    }
    if (!styleLabel) {
      crmToastError('Please select a travel style.');
      return;
    }

    let n = Math.floor(Number(aiNumDays));
    if (!Number.isFinite(n)) {
      crmToastError('Please enter a valid number of days.');
      return;
    }
    n = Math.min(14, Math.max(1, n));

    setAiGenerating(true);
    try {
      const filtersRes = await getCmsPackageFilters();
      const destinationCheck = validateTripBriefForItinerary(tripBrief, filtersRes.destinations);
      if (!destinationCheck.ok) {
        crmToastError(destinationCheck.error);
        return;
      }
      const hub = destinationCheck.place;

      await new Promise((r) => window.setTimeout(r, 900));

      const [packagesRes] = await Promise.all([
        listCmsPackages({ limit: 200, published: true }),
      ]);
      const catalog = packagesRes.items.map(mapPackageListFromApi);
      const benchmark = pickPackageBenchmark(
        catalog,
        tripBrief,
        hub,
        n,
        filtersRes.destinations,
      );

      const mergedIntent =
        crmItineraryIntent ??
        crmItineraryIntentRef.current ??
        readCrmItineraryCreationIntentFromStorage();
      const custFromIntent = mergedIntent?.customerId?.trim();
      const resolvedCustomer =
        custFromIntent || (await resolveCrmCustomerId(mergedIntent)) || undefined;

      const created = await addItinerary({
        title: `AI: ${hub} ${n}-Day Trip`,
        description: `Travel style: ${styleLabel}`,
        customerId: resolvedCustomer,
        status: 'DRAFT',
        totalPrice: 0,
        markupMargin: AI_ITINERARY_MARKUP,
        taxRate: AI_ITINERARY_TAX,
        isTemplate: false,
        days: [],
      });

      const itineraryId = created.id;
      const dayDrafts = buildAiItineraryDraft(
        n,
        hub,
        tripBrief,
        styleLabel,
        AI_DAY_THEME_TEMPLATES,
        benchmark,
      );
      const builtDays: NonNullable<Itinerary['days']> = dayDrafts.map((dayDraft) => ({
        id: newLocalId('day'),
        dayNumber: dayDraft.dayNumber,
        title: dayDraft.title,
        description: dayDraft.description,
        items: dayDraft.items.map((row) => ({
          ...row,
          details: stripItineraryPriceMentions(row.details),
          id: newLocalId('item'),
        })),
      }));

      const snapshot = {
        ...created,
        days: builtDays,
        markupMargin: AI_ITINERARY_MARKUP,
        taxRate: AI_ITINERARY_TAX,
        totalPrice: computeItineraryTotalPrice({
          days: builtDays,
          markupMargin: AI_ITINERARY_MARKUP,
          taxRate: AI_ITINERARY_TAX,
        }),
      };
      updateItinerary(itineraryId, { days: builtDays });

      await saveItinerary(itineraryId, snapshot);

      setSelectedItinId(itineraryId);

      setShowAiModal(false);
      setAiDestination('');
      setAiNumDays('');
      setAiTravelStyle('');
      crmToastSuccess(
        benchmark
          ? `Itinerary generated — aligned with catalog package “${benchmark.referencePackage.title}”`
          : 'Itinerary generated',
      );
    } catch (err) {
      console.error(err);
      crmToastError('Something went wrong while generating. Check the browser console.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveItinerary = async () => {
    if (!activeItinerary || savingItinerary) return;
    setSavingItinerary(true);
    try {
      await saveItinerary(activeItinerary.id);
      crmToastSuccess('Itinerary saved');
    } catch (err) {
      crmToastError(err instanceof Error ? err.message : 'Failed to save itinerary');
    } finally {
      setSavingItinerary(false);
    }
  };

  const activeItineraryDirty = activeItinerary ? dirtyIds.has(activeItinerary.id) : false;

  useEffect(() => {
    if (!showAddItemModal) {
      setEditingItemCtx(null);
      return;
    }
    if (editingItemCtx && editingItemCtx.dayId === showAddItemModal.dayId) {
      const i = editingItemCtx.item;
      setItemType(i.type);
      setItemTitle(i.title);
      setItemDetails(i.details);
    } else {
      setItemType('HOTEL');
      setItemTitle('');
      setItemDetails('');
    }
  }, [showAddItemModal, editingItemCtx]);

  const itineraryPricing = useMemo(() => {
    if (!activeItinerary) {
      return { itemsSubtotal: 0, total: 0 };
    }
    const itemsSubtotal = (activeItinerary.days ?? []).reduce(
      (acc, day) => acc + (day.items ?? []).reduce((sum, item) => sum + Number(item.sellingPrice), 0),
      0,
    );
    const total = computeItineraryTotalPrice({
      days: activeItinerary.days ?? [],
      markupMargin: activeItinerary.markupMargin ?? 0,
      taxRate: activeItinerary.taxRate ?? 0,
      discountRate: activeItinerary.discountRate ?? 0,
    });
    return { itemsSubtotal, total };
  }, [
    activeItinerary?.days,
    activeItinerary?.markupMargin,
    activeItinerary?.taxRate,
    activeItinerary?.discountRate,
  ]);

  const activeEditorPlace = useMemo(
    () => (activeItinerary ? itineraryPlaceFromTitle(activeItinerary.title) : null),
    [activeItinerary],
  );

  const activeTravelStyle = useMemo(() => {
    const match = activeItinerary?.description?.match(/Travel style:\s*([^\n]+)/i);
    return match?.[1]?.trim() ?? null;
  }, [activeItinerary?.description]);

  const [railSearch, setRailSearch] = useState('');
  const filteredItineraries = useMemo(() => {
    const q = railSearch.trim().toLowerCase();
    if (!q) return agencyItineraries;
    return agencyItineraries.filter((itin) => itin.title.toLowerCase().includes(q));
  }, [agencyItineraries, railSearch]);

  return (
    <>
      {itinerariesError ? (
        <div className="no-print mx-auto mb-3 w-full max-w-[calc(100vw-2rem)] rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {itinerariesError}
        </div>
      ) : null}
      {crmItineraryIntent ? (
        <div className="no-print mx-auto mb-3 flex w-full max-w-[calc(100vw-2rem)] flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-950/35 px-4 py-3 text-[11px] leading-relaxed text-sky-100">
          <p className="min-w-0 flex-1">
            {activeItinerary ? (
              <>
                Lead link active — edit this trip below. When you are ready, click{' '}
                <span className="font-semibold text-sky-50">Assign</span> to attach it to the lead and return to CRM, or{' '}
                <span className="font-semibold text-sky-50">End lead link</span> to leave without assigning.
              </>
            ) : (
              <>
                Started from CRM — use{' '}
                <span className="font-semibold text-sky-50">New Itinerary</span> or{' '}
                <span className="font-semibold text-sky-50">AI Generate</span> to create a trip, then click{' '}
                <span className="font-semibold text-sky-50">Assign</span> when you want to attach it to the lead.{' '}
              </>
            )}
            {crmItineraryIntent.customerId
              ? '(Traveller can be carried from CRM when linked.)'
              : '(Link a traveller in CRM when you are ready to book.)'}
          </p>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={exitCrmItineraryContext}
              className="rounded-lg border border-sky-400/40 bg-transparent px-3 py-2 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/10"
            >
              End lead link
            </button>
            {activeItinerary ? (
              <button
                type="button"
                onClick={() => assignItineraryToCrmLead(activeItinerary)}
                className="rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-bold text-sky-950 hover:bg-sky-400"
              >
                Assign
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="crm-itinerary-page">
      <div className="crm-itinerary-workspace">
        <aside className="crm-itin-rail">
          <div className="crm-itin-rail__head">
            <h2 className="crm-itin-rail__title">
              Itineraries
              {!itinerariesLoading && agencyItineraries.length > 0 ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {agencyItineraries.length}
                </span>
              ) : null}
            </h2>
            <div className="crm-itin-rail__head-actions">
              <button
                type="button"
                onClick={openAiModalForCurrentContext}
                title="AI Generate itinerary"
                aria-label="AI Generate itinerary"
                className="crm-itin-rail__icon-btn"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>AI Generate</span>
              </button>
              <button
                type="button"
                onClick={openNewItineraryModal}
                title="New itinerary"
                aria-label="New itinerary"
                className="crm-itin-rail__icon-btn crm-itin-rail__icon-btn--primary"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>New itinerary</span>
              </button>
            </div>
          </div>
          <div className="crm-itin-rail__search">
            <Search aria-hidden />
            <input
              type="text"
              value={railSearch}
              onChange={(e) => setRailSearch(e.target.value)}
              placeholder="Search itineraries…"
              aria-label="Search itineraries"
            />
          </div>
          <div className="crm-itin-rail__list">
            {itinerariesLoading ? (
              <p className="crm-itin-rail__empty">Loading itineraries…</p>
            ) : filteredItineraries.length === 0 ? (
              <p className="crm-itin-rail__empty">
                {railSearch.trim() ? (
                  <>No itineraries match “{railSearch.trim()}”.</>
                ) : crmItineraryIntent?.leadId ? (
                  <>
                    No itineraries yet. Use{' '}
                    <span className="font-semibold text-foreground">+</span> or{' '}
                    <span className="font-semibold text-foreground">AI Generate</span> above.
                  </>
                ) : (
                  <>
                    No itineraries yet. Create one with{' '}
                    <span className="font-semibold text-foreground">+</span> above.
                  </>
                )}
              </p>
            ) : (
              filteredItineraries.map((itin) => (
                <ItineraryRailCard
                  key={itin.id}
                  itinerary={itin}
                  selected={itin.id === selectedItinId}
                  clientTotal={resolveClientTotal(itin)}
                  unsaved={dirtyIds.has(itin.id)}
                  onSelect={() => setSelectedItinId(itin.id)}
                  onDelete={(e) => handleDeleteSidebarItinerary(itin, e)}
                />
              ))
            )}
          </div>
        </aside>

        <div className="crm-itin-main">
          {activeItinerary ? (
            <>
              <header className="crm-itin-toolbar">
                <input
                  type="text"
                  value={activeItinerary.title}
                  onChange={(e) => updateItinerary(activeItinerary.id, { title: e.target.value })}
                  className="crm-itin-toolbar__title"
                  placeholder="Itinerary title"
                  aria-label="Itinerary title"
                />
                <div className="crm-itin-status-select">
                  <span className="crm-itin-dot" data-status={activeItinerary.status} />
                  <select
                    value={activeItinerary.status}
                    onChange={(e) =>
                      updateItinerary(activeItinerary.id, {
                        status: e.target.value as Itinerary['status'],
                      })
                    }
                    aria-label="Trip status"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SENT">Sent to client</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <ChevronDown className="crm-itin-status-select__chevron" aria-hidden />
                </div>
                <div className="crm-itin-toolbar__divider" />
                <ClientTotalBadge total={itineraryPricing.total} />
                <div className="crm-itin-toolbar__actions">
                  <button type="button" onClick={handlePrint} className="crm-itin-btn">
                    <Printer aria-hidden />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="crm-itin-btn"
                  >
                    <Share2 aria-hidden />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItinerary}
                    disabled={savingItinerary || !activeItineraryDirty}
                    className="crm-itin-btn crm-itin-btn--primary"
                  >
                    <Save aria-hidden />
                    {savingItinerary ? 'Saving…' : activeItineraryDirty ? 'Save changes' : 'Saved'}
                  </button>
                </div>
              </header>

              <div className="crm-itin-meta">
                {activeEditorPlace ? (
                  <span className="crm-itin-meta__item">
                    <span className="crm-itin-meta__label">Destination</span>
                    <span className="crm-itin-meta__value">{activeEditorPlace}</span>
                  </span>
                ) : null}
                <span className="crm-itin-meta__item">
                  <span className="crm-itin-meta__label">Duration</span>
                  <span className="crm-itin-meta__value">
                    {(activeItinerary.days ?? []).length}{' '}
                    {(activeItinerary.days ?? []).length === 1 ? 'day' : 'days'}
                  </span>
                </span>
                {activeTravelStyle ? (
                  <span className="crm-itin-meta__item">
                    <span className="crm-itin-meta__label">Style</span>
                    <span className="crm-itin-meta__value">{activeTravelStyle}</span>
                  </span>
                ) : null}
                <span className="crm-itin-meta__item">
                  <span className="crm-itin-meta__label">Activities</span>
                  <span className="crm-itin-meta__value">
                    {(activeItinerary.days ?? []).reduce(
                      (acc, d) => acc + (d.items?.length ?? 0),
                      0,
                    )}
                  </span>
                </span>
                {clientProfile ? (
                  <span className="crm-itin-meta__item">
                    <span className="crm-itin-meta__label">Traveller</span>
                    <span className="crm-itin-meta__value">
                      {clientProfile.firstName} {clientProfile.lastName}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className="crm-itin-body">
                <div className="crm-itin-body__main">
                  {(activeItinerary.days ?? []).length === 0 ? (
                    <div className="crm-itin-empty">
                      <div className="crm-itin-empty__icon">
                        <Calendar className="h-5 w-5" aria-hidden />
                      </div>
                      <p className="crm-itin-empty__title">No days yet</p>
                      <p className="crm-itin-empty__text">
                        Add a day to build your draft proposal, or use AI Generate to scaffold a trip.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddDay}
                        className="crm-itin-btn crm-itin-btn--primary mt-1"
                      >
                        <Plus aria-hidden />
                        Add day
                      </button>
                    </div>
                  ) : (
                    <section className="crm-itin-preview-section no-print">
                      <div className="crm-itin-preview-section__head">
                        <h3 className="crm-itin-preview-section__title">Draft proposal</h3>
                        <p className="crm-itin-preview-section__hint">
                          Edit each day below — this matches what your customer sees on the shared link.
                        </p>
                      </div>
                      <div className="crm-itin-preview-section__frame">
                        <DraftProposalEditor
                          itinerary={activeItinerary}
                          destinationHub={destinationHub}
                          onUpdateDayTitle={(dayId, title) =>
                            updateItineraryDay(activeItinerary.id, dayId, { title })
                          }
                          onDeleteDay={(dayId) =>
                            deleteItineraryDay(activeItinerary.id, dayId)
                          }
                          onAddDay={handleAddDay}
                          onAddActivity={(dayId) => {
                            setEditingItemCtx(null);
                            setShowAddItemModal({ dayId });
                          }}
                          onEditActivity={(dayId, item) => {
                            setEditingItemCtx({ dayId, item });
                            setShowAddItemModal({ dayId });
                          }}
                          onDeleteActivity={(dayId, itemId) => {
                            crmToastConfirm('Remove this activity from the day?', {
                              confirmLabel: 'Remove',
                              onConfirm: () => {
                                deleteItineraryItem(activeItinerary.id, dayId, itemId);
                                if (
                                  editingItemCtx?.dayId === dayId &&
                                  editingItemCtx.item.id === itemId
                                ) {
                                  setEditingItemCtx(null);
                                  setItemTitle('');
                                  setItemDetails('');
                                  setItemType('HOTEL');
                                }
                                crmToastSuccess('Activity removed');
                              },
                            });
                          }}
                        />
                      </div>
                    </section>
                  )}

                  <div className="crm-itin-print-only" aria-hidden>
                    <ClientProposalView
                      id="itinerary-preview-element"
                      itinerary={activeItinerary}
                      themeId={proposalTheme}
                      agencyName={currentAgency.name}
                      agencyLogoUrl={currentAgency.logoUrl}
                      clientName={clientName}
                    />
                  </div>
                </div>

                <aside className="crm-itin-body__pricing no-print" aria-label="Client pricing">
                  <ClientPricingPanel
                    itemsSubtotal={itineraryPricing.itemsSubtotal}
                    markupMargin={activeItinerary.markupMargin ?? 0}
                    taxRate={activeItinerary.taxRate ?? 0}
                    discountRate={activeItinerary.discountRate ?? 0}
                    showDiscount={isAdmin}
                    onChange={(patch) => updateItinerary(activeItinerary.id, patch)}
                  />
                </aside>
              </div>
            </>
          ) : (
            <div className="crm-itin-empty">
              <div className="crm-itin-empty__icon">
                <Compass className="h-7 w-7" />
              </div>
              <p className="crm-itin-empty__title">No itinerary selected</p>
              <p className="crm-itin-empty__text">
                {crmItineraryIntent?.leadId
                  ? 'Use New or AI Generate in the sidebar to create this trip — it appears in the list after you finish.'
                  : 'Select an itinerary from the list or create a new one to start editing days and activities.'}
              </p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Add Itinerary Modal */}
      {showAddItinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">New Itinerary Proposal</h2>
              <button onClick={cancelNewItineraryModal} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItin} className="space-y-4">
              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Itinerary Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Signature Luxury Kashmir Escape"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Plan Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description summarizing the sights covered."
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary"
                  rows={3}
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Associate Traveler / Customer Profile
                </label>
                <select
                  value={newCustId}
                  onChange={(e) => setNewCustId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                >
                  <option value="">None (Standalone Template)</option>
                  {agencyCustomers.map((cust) => (
                    <option key={cust.id} value={cust.id}>{cust.firstName} {cust.lastName} ({cust.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <DatePickerInput
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    inputClassName="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <DatePickerInput
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    inputClassName="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelNewItineraryModal}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Build Base Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && activeItinerary && (
        <div className="crm-itin-modal-overlay">
          <div className="crm-itin-modal animate-scale-in" role="dialog" aria-modal="true">
            <div className="crm-itin-modal__head">
              <div>
                <h2 className="crm-itin-modal__title">
                  {editingItemCtx ? 'Edit activity' : 'Add activity'}
                </h2>
                {itemModalDay ? (
                  <p className="crm-itin-modal__subtitle">
                    Day {itemModalDay.dayNumber} · {itemModalDay.title || 'Untitled day'}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setEditingItemCtx(null);
                  setShowAddItemModal(null);
                }}
                className="crm-itin-modal__close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="crm-itin-modal__body">
              {itemModalDay && itemModalDay.items.length > 0 && (
                <div>
                  <p className="crm-itin-modal__section-label">
                    Scheduled on this day ({itemModalDay.items.length})
                  </p>
                  <div className="crm-itin-modal__list">
                    {itemModalDay.items.map((item) => {
                      const display = splitActivityDisplayTitle(item.title);
                      const isEditingThis =
                        editingItemCtx?.dayId === itemModalDay.id &&
                        editingItemCtx.item.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`crm-itin-modal__row${
                            isEditingThis ? ' crm-itin-modal__row--editing' : ''
                          }`}
                        >
                          <span className="crm-itin-modal__row-time">{display.time}</span>
                          <p className="crm-itin-modal__row-label" title={display.label}>
                            {display.label}
                          </p>
                          <div className="crm-itin-modal__row-actions">
                            {isEditingThis ? (
                              <span className="crm-itin-modal__editing-chip">Editing</span>
                            ) : (
                              <button
                                type="button"
                                title="Edit activity"
                                aria-label={`Edit activity: ${display.label}`}
                                onClick={() => setEditingItemCtx({ dayId: itemModalDay.id, item })}
                                className="crm-itin-icon-btn"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Remove activity"
                              aria-label={`Remove activity: ${display.label}`}
                              onClick={() => {
                                crmToastConfirm('Remove this activity from the day?', {
                                  confirmLabel: 'Remove',
                                  onConfirm: () => {
                                    deleteItineraryItem(activeItinerary.id, itemModalDay.id, item.id);
                                    if (
                                      editingItemCtx?.dayId === itemModalDay.id &&
                                      editingItemCtx.item.id === item.id
                                    ) {
                                      setEditingItemCtx(null);
                                      setItemTitle('');
                                      setItemDetails('');
                                      setItemType('HOTEL');
                                    }
                                    crmToastSuccess('Activity removed');
                                  },
                                });
                              }}
                              className="crm-itin-icon-btn crm-itin-icon-btn--danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form id="itin-activity-form" onSubmit={handleAddItemSubmit} className="space-y-3">
                <p className="crm-itin-modal__section-label">
                  {editingItemCtx ? 'Edit details' : 'New activity'}
                </p>
                <div className="crm-itin-form-grid">
                  <div className="crm-itin-field">
                    <label className="crm-itin-field__label" htmlFor="itin-item-type">
                      Segment type
                    </label>
                    <select
                      id="itin-item-type"
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value as ItineraryItem['type'])}
                    >
                      <option value="FLIGHT">Flight</option>
                      <option value="HOTEL">Hotel stay</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="ACTIVITY">Activity</option>
                      <option value="MEAL">Meal / dining</option>
                      <option value="NOTE">Note</option>
                    </select>
                  </div>

                  <div className="crm-itin-field">
                    <label className="crm-itin-field__label" htmlFor="itin-item-title">
                      Title
                    </label>
                    <input
                      id="itin-item-title"
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="e.g. Morning — Airport arrival"
                      style={{ height: '2rem' }}
                    />
                    <p className="crm-itin-field__help">
                      Start with Morning, Afternoon, or Evening (“Morning — …”) to show it in the schedule.
                    </p>
                  </div>
                </div>

                <div className="crm-itin-field">
                  <label className="crm-itin-field__label" htmlFor="itin-item-details">
                    Details
                  </label>
                  <textarea
                    id="itin-item-details"
                    required
                    value={itemDetails}
                    onChange={(e) => setItemDetails(e.target.value)}
                    placeholder="Venue or location first, then description on a new line."
                    rows={3}
                  />
                  <p className="crm-itin-field__help">
                    The first line is treated as the location and shown with a map pin.
                  </p>
                </div>
              </form>
            </div>

            <div className="crm-itin-modal__foot">
              <button
                type="button"
                onClick={() => {
                  setEditingItemCtx(null);
                  setShowAddItemModal(null);
                }}
                className="crm-itin-btn"
              >
                Cancel
              </button>
              <button type="submit" form="itin-activity-form" className="crm-itin-btn crm-itin-btn--primary">
                {editingItemCtx ? 'Save changes' : 'Add activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share proposal modal */}
      {showShareModal && activeItinerary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold">Share Customer Proposal</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Share a clean white proposal link with your client
                </p>
              </div>
              <button type="button" onClick={() => setShowShareModal(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-border">
              <ClientProposalView
                itinerary={activeItinerary}
                themeId={proposalTheme}
                agencyName={currentAgency.name}
                agencyLogoUrl={currentAgency.logoUrl}
                clientName={clientName}
                compact
              />
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Your client can review this polished itinerary, upload travel documents, and pay invoices securely.
            </p>

            <div className="p-3 bg-secondary rounded-lg border border-border/80 flex items-center justify-between gap-2 font-mono">
              <span className="truncate text-primary text-[10px]">{shareUrl}</span>
              <button
                type="button"
                onClick={() => {
                  const url = buildProposalShareUrl(
                    window.location.origin,
                    activeItinerary.id,
                    proposalTheme
                  );
                  navigator.clipboard.writeText(url);
                  crmToastSuccess('Share link copied');
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] shrink-0"
              >
                Copy Link
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Itinerary Generator */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="ai-itinerary-title"
            aria-modal="true"
            className="w-full max-w-md animate-scale-in rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <span className="relative">
                    <Wand2 className="h-5 w-5 text-primary" />
                    <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-amber-400" aria-hidden />
                  </span>
                </span>
                <div>
                  <h2 id="ai-itinerary-title" className="text-lg font-bold leading-tight text-foreground">
                    AI Itinerary Generator
                  </h2>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Builds a new trip with sample segments you can rename and edit from{' '}
                    <span className="font-semibold text-foreground/85">Trip days</span>: use{' '}
                    <span className="font-semibold text-foreground/85">Add activity</span> or inline{' '}
                    <span className="font-semibold text-foreground/85">Change</span>
                    /
                    <span className="font-semibold text-foreground/85">Remove</span>. Your sidebar selection is
                    otherwise unchanged.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !aiGenerating && setShowAiModal(false)}
                disabled={aiGenerating}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAiModalGenerate} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="ai-destination" className="text-sm font-medium text-foreground">
                  Destination & trip details
                </label>
                <textarea
                  id="ai-destination"
                  value={aiDestination}
                  onChange={(e) => setAiDestination(e.target.value)}
                  placeholder="Describe the trip — destination, dates, hotels, activities…"
                  rows={5}
                  disabled={aiGenerating}
                  className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ai-days" className="text-sm font-medium text-foreground">
                  Number of Days
                </label>
                <input
                  id="ai-days"
                  type="number"
                  min={1}
                  max={14}
                  value={aiNumDays}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setAiNumDays('');
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n)) {
                      setAiNumDays('');
                      return;
                    }
                    setAiNumDays(Math.min(14, Math.max(1, Math.floor(n))));
                  }}
                  placeholder="e.g. 5"
                  disabled={aiGenerating}
                  className="w-full rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ai-travel-style" className="text-sm font-medium text-foreground">
                  Travel Style
                </label>
                <div className="relative">
                  <select
                    id="ai-travel-style"
                    value={aiTravelStyle}
                    onChange={(e) => setAiTravelStyle(e.target.value)}
                    disabled={aiGenerating}
                    className="w-full appearance-none rounded-xl border border-border bg-secondary/40 py-2.5 pl-3.5 pr-10 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select travel style</option>
                    {TRAVEL_STYLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <button
                type="submit"
                disabled={aiGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-600 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-500 disabled:opacity-45 dark:bg-slate-500 dark:hover:bg-slate-400"
              >
                {aiGenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Building…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate Itinerary
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
