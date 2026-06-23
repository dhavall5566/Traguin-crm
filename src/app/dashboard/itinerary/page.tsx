'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, Itinerary, ItineraryItem } from '@/lib/store';
import { useItineraryPage } from '@/hooks/useItineraryPage';
import { getLead, mergeLeadExtras } from '@/lib/api/leads';
import { computeItineraryTotalPrice, newLocalId } from '@/lib/api/itineraries';
import {
  CrmItineraryCreationIntent,
  STORAGE_CRM_RESUME_BOOKING,
  clearCrmItineraryCreationIntentFromStorage,
  readCrmItineraryCreationIntentFromStorage,
} from '@/lib/crmItineraryHandoff';
import ClientProposalView from '@/components/proposal/ClientProposalView';
import ProposalThemePicker from '@/components/proposal/ProposalThemePicker';
import {
  buildProposalShareUrl,
  ProposalThemeId,
  resolveProposalTheme,
} from '@/lib/proposalThemes';
import {
  Compass,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  Share2,
  MapPin,
  X,
  Percent,
  ChevronDown,
  Save,
  Wand2,
  Pencil,
} from 'lucide-react';

const statusLabels: Record<Itinerary['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

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

export default function ItineraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAgency = useStore((state) => state.currentAgency);
  const bookings = useStore((state) => state.bookings);
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
  const [saveToast, setSaveToast] = useState(false);

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
  const [aiNumDays, setAiNumDays] = useState(5);
  const [aiTravelStyle, setAiTravelStyle] = useState<string>('Balanced');

  /** Selected day controls “Add activity”, inline change/remove list, title & overview edits */
  const [scheduleDayId, setScheduleDayId] = useState('');

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
  const [itemCost, setItemCost] = useState('');
  const [itemSelling, setItemSelling] = useState('');

  useEffect(() => {
    if (!saveToast) return undefined;
    const t = window.setTimeout(() => setSaveToast(false), 2800);
    return () => window.clearTimeout(t);
  }, [saveToast]);

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

  const persistCrmProposalToLead = useCallback((newItineraryId: string) => {
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
        }),
      );
    } catch {
      /* resume marker optional — proposal already on lead extras */
    }
    return true;
  }, []);

  const finishItineraryForCrmIfNeeded = useCallback(
    (newItineraryId: string) => {
      if (!persistCrmProposalToLead(newItineraryId)) return false;
      clearCrmItineraryCreationIntentFromStorage();
      crmItineraryIntentRef.current = null;
      setCrmItineraryIntent(null);
      router.push('/dashboard/crm');
      return true;
    },
    [router, persistCrmProposalToLead],
  );

  const handleDeleteSidebarItinerary = useCallback(
    async (itin: Itinerary, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const doomedBookings = bookings.filter(
        (b) => b.agencyId === itin.agencyId && b.itineraryId === itin.id,
      );
      const msg =
        doomedBookings.length > 0
          ? `Delete "${itin.title}"? This removes ${doomedBookings.length} linked booking(s) and their invoices.`
          : `Delete "${itin.title}"? This cannot be undone.`;
      if (!window.confirm(msg)) return;
      try {
        await deleteItinerary(itin.id);
        if (selectedItinId === itin.id) setSelectedItinId('');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete itinerary');
      }
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
    void hydrateItineraryDetail(selectedItinId);
  }, [selectedItinId, hydrateItineraryDetail]);

  /** Derive from `itineraries` (already subscribed above) so edits to days always re-render reliably. */
  const activeItinerary = useMemo(
    () =>
      itineraries.find((i) => i.id === selectedItinId && i.agencyId === currentAgency.id) ?? undefined,
    [itineraries, selectedItinId, currentAgency.id],
  );
  const clientProfile = agencyCustomers.find(c => c.id === activeItinerary?.customerId);
  const proposalTheme = resolveProposalTheme(activeItinerary?.proposalTheme);
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

  const selectedScheduleDay = useMemo(() => {
    if (!activeItinerary || !scheduleDayId) return undefined;
    return (activeItinerary.days ?? []).find((d) => d.id === scheduleDayId);
  }, [activeItinerary, scheduleDayId]);

  useEffect(() => {
    const days = activeItinerary?.days ?? [];
    if (days.length === 0) {
      setScheduleDayId('');
      return;
    }
    setScheduleDayId((prev) => (prev && days.some((d) => d.id === prev) ? prev : days[0].id));
  }, [activeItinerary]);

  const handleProposalThemeChange = (theme: ProposalThemeId) => {
    if (!activeItinerary) return;
    updateItinerary(activeItinerary.id, { proposalTheme: theme });
  };

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
        markupMargin: 15,
        taxRate: 10,
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

      persistCrmProposalToLead(newItinId);

      setSelectedItinId(newItinId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create itinerary');
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
    const goal = intent?.leadGoalTitle?.trim();
    setNewTitle(goal ?? '');
    if (intent?.leadId) {
      void getLead(intent.leadId).then((lead) => {
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
            return base.customerId?.trim() ? base : { ...base, customerId: cid };
          });
        }
      });
    }
    setShowAddItinModal(true);
  };

  const openAiModalForCurrentContext = () => {
    const mergedIntent =
      crmItineraryIntent ??
      crmItineraryIntentRef.current ??
      readCrmItineraryCreationIntentFromStorage();
    const crmGoal = mergedIntent?.leadGoalTitle?.trim();
    const hint = agencyItineraries.find((i) => i.id === selectedItinId);
    setAiDestination(crmGoal || (hint?.description?.trim() ?? ''));
    setAiNumDays(5);
    setAiTravelStyle('Balanced');
    setShowAiModal(true);
  };

  const handleAddDay = () => {
    if (!activeItinerary) return;

    const dayNum = (activeItinerary.days?.length ?? 0) + 1;
    const newDayId = addItineraryDay(
      activeItinerary.id,
      `Day ${dayNum}: Tour Schedule`,
      'Describe the sights to visit.',
    );
    if (newDayId) setScheduleDayId(newDayId);
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
          details: itemDetails,
          costPrice: Number(itemCost) || 0,
          sellingPrice: Number(itemSelling) || 0,
        }
      );
    } else {
      addItineraryItem(activeItinerary.id, showAddItemModal.dayId, {
        type: itemType,
        title: itemTitle,
        details: itemDetails,
        costPrice: Number(itemCost) || 0,
        sellingPrice: Number(itemSelling) || 0,
      });
    }

    setItemTitle('');
    setItemDetails('');
    setItemCost('');
    setItemSelling('');
    setEditingItemCtx(null);
    setShowAddItemModal(null);
  };

  /** Synthetic multi-day blueprint: always creates a new itinerary row and selects it in the sidebar. */
  const handleAiModalGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const dest = aiDestination.trim();
    if (!dest) {
      alert('Please enter a destination.');
      return;
    }

    let n = Math.floor(Number(aiNumDays));
    if (!Number.isFinite(n)) n = 5;
    n = Math.min(14, Math.max(1, n));

    const styleLabel = aiTravelStyle;

    setAiGenerating(true);
    try {
      await new Promise((r) => window.setTimeout(r, 900));

      const hub = dest.split(',')[0]?.trim() || dest;

      const mergedIntent =
        crmItineraryIntent ??
        crmItineraryIntentRef.current ??
        readCrmItineraryCreationIntentFromStorage();
      const custFromIntent = mergedIntent?.customerId?.trim();
      const resolvedCustomer =
        custFromIntent || (await resolveCrmCustomerId(mergedIntent)) || undefined;

      const created = await addItinerary({
        title: `AI: ${hub} ${n}-Day Trip`,
        description: dest,
        customerId: resolvedCustomer,
        status: 'DRAFT',
        totalPrice: 0,
        markupMargin: 15,
        taxRate: 10,
        isTemplate: false,
        days: [],
      });

      const itineraryId = created.id;
      const builtDays: NonNullable<Itinerary['days']> = [];

      const mult =
        styleLabel === 'Luxury'
          ? 1.35
          : styleLabel === 'Budget'
            ? 0.82
            : styleLabel === 'Adventure'
              ? 1.12
              : 1;

      const sc = (s: number): Pick<ItineraryItem, 'costPrice' | 'sellingPrice'> => ({
        sellingPrice: Math.round((s * mult) / 50) * 50,
        costPrice: Math.round((s * mult * 0.7) / 50) * 50,
      });

      const pack = (d: number): Omit<ItineraryItem, 'id'>[] => {
        if (d === 1) {
          return [
            {
              type: 'TRANSFER',
              title: `09:30 AM — Arrival in ${hub}`,
              details: `${dest}\nAirport/station greeting and seamless transfers.`,
              ...sc(9400),
            },
            {
              type: 'ACTIVITY',
              title: `02:30 PM — Core district orientation`,
              details: `${hub}\nEase into landmarks with ${styleLabel.toLowerCase()} pacing.`,
              ...sc(7200),
            },
            {
              type: 'MEAL',
              title: `07:30 PM — Welcome dinner`,
              details: `${hub}\nRegional menu suited for today.`,
              ...sc(8300),
            },
          ];
        }
        if (d === n) {
          return [
            {
              type: 'ACTIVITY',
              title: `09:00 AM — Closing highlights`,
              details: `${hub}\nFlexible final experiences before onward travel.`,
              ...sc(6800),
            },
            {
              type: 'MEAL',
              title: `12:30 PM — Farewell meal`,
              details: `${hub}\nComfortable midday send-off.`,
              ...sc(5600),
            },
            {
              type: 'TRANSFER',
              title: `03:30 PM — Departure transfer`,
              details: `${hub}\nReliable routing to terminals.`,
              ...sc(7900),
            },
          ];
        }
        return [
          {
            type: 'ACTIVITY',
            title: `10:00 AM — Curated excursion`,
            details: `${hub}\nImmersive block aligned with "${styleLabel}".`,
            ...sc(9100),
          },
          {
            type: 'MEAL',
            title: `01:00 PM — Local lunch`,
            details: `${hub}\nHand-picked midday stop.`,
            ...sc(5400),
          },
          {
            type: 'ACTIVITY',
            title: `04:30 PM — Afternoon deep-dive`,
            details: `${hub}\nContinuation of the day theme.`,
            ...sc(8600),
          },
        ];
      };

      for (let d = 1; d <= n; d += 1) {
        const themeLabel = AI_DAY_THEME_TEMPLATES[(d - 1) % AI_DAY_THEME_TEMPLATES.length];
        const dayId = newLocalId('day');
        const dayItems = pack(d).map((row) => ({ ...row, id: newLocalId('item') }));
        builtDays.push({
          id: dayId,
          dayNumber: d,
          title: `Day ${d}: ${themeLabel}`,
          description: `AI · ${styleLabel} · Day ${d} of ${n} · ${hub}`,
          items: dayItems,
        });
      }

      const snapshot = {
        ...created,
        days: builtDays,
        markupMargin: 15,
        taxRate: 10,
        totalPrice: computeItineraryTotalPrice({
          days: builtDays,
          markupMargin: 15,
          taxRate: 10,
        }),
      };
      updateItinerary(itineraryId, { days: builtDays });

      persistCrmProposalToLead(itineraryId);

      await saveItinerary(itineraryId, snapshot);

      setSelectedItinId(itineraryId);

      setShowAiModal(false);
      setAiDestination('');
      setAiNumDays(5);
      setAiTravelStyle('Balanced');
    } catch (err) {
      console.error(err);
      alert('Something went wrong while generating. Check the browser console.');
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
      setSaveToast(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save itinerary');
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
      setItemCost(String(i.costPrice));
      setItemSelling(String(i.sellingPrice));
    } else {
      setItemType('HOTEL');
      setItemTitle('');
      setItemDetails('');
      setItemCost('');
      setItemSelling('');
    }
  }, [showAddItemModal, editingItemCtx]);

  const baseSellingTotal = activeItinerary
    ? (activeItinerary.days ?? []).reduce(
        (acc, d) => acc + (d.items ?? []).reduce((s, i) => s + Number(i.sellingPrice), 0),
        0,
      )
    : 0;

  return (
    <>
      {saveToast ? (
        <div className="no-print fixed bottom-4 right-4 z-50 rounded-lg border border-emerald-500/30 bg-emerald-950/90 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-lg">
          Itinerary saved
        </div>
      ) : null}
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
                Lead link active — edit this trip below (day titles, day overview,{' '}
                <span className="font-semibold text-sky-50">Add activity</span>). When satisfied,{' '}
                <span className="font-semibold text-sky-50">Return to CRM lead</span> attaches it — or{' '}
                <span className="font-semibold text-sky-50">End lead link</span> to drop the CRM context.
              </>
            ) : (
              <>
                Started from CRM — use{' '}
                <span className="font-semibold text-sky-50">New Itinerary</span> or{' '}
                <span className="font-semibold text-sky-50">AI Generate</span> to create a trip, then{' '}
                <span className="font-semibold text-sky-50">Return to CRM lead</span> to attach it.{' '}
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
                onClick={() => finishItineraryForCrmIfNeeded(activeItinerary.id)}
                className="rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-bold text-sky-950 hover:bg-sky-400"
              >
                Return to CRM lead
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col lg:flex-row rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-[calc(100vh-7.5rem)] text-xs">
        {/* —— Sidebar: itinerary list —— */}
        <aside className="flex w-full shrink-0 flex-col border-b border-border bg-secondary/30 lg:w-[300px] lg:min-h-0 lg:flex-[0_0_300px] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-border/80 p-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground">Itineraries</h2>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground">New Itinerary</span> starts blank.{' '}
                <span className="font-semibold text-foreground">AI Generate</span> lays down sample days &amp;
                segments — refine everything here or with{' '}
                <span className="font-semibold text-foreground">Add activity</span> — use{' '}
                <span className="font-semibold text-foreground">Change</span> /{' '}
                <span className="font-semibold text-foreground">Remove</span> on each segment. Click a card to open it.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewItineraryModal}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              New Itinerary
            </button>
            <button
              type="button"
              onClick={openAiModalForCurrentContext}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
            >
              <Wand2 className="h-4 w-4 text-primary" />
              AI Generate
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 lg:min-h-[200px]">
            {itinerariesLoading ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
                Loading itineraries…
              </p>
            ) : agencyItineraries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
                {crmItineraryIntent?.leadId ? (
                  <>
                    No itineraries yet. Use <span className="font-semibold text-foreground">New Itinerary</span> or{' '}
                    <span className="font-semibold text-foreground">AI Generate</span> above to create this trip.
                  </>
                ) : (
                  <>
                    No itineraries yet. Create one with{' '}
                    <span className="font-semibold text-foreground">New Itinerary</span>.
                  </>
                )}
              </p>
            ) : (
              agencyItineraries.map((itin) => {
                const selected = itin.id === selectedItinId;
                const loc = itin.description?.trim() || 'Add destination in plan';
                const dayCount = itin.days?.length ?? 0;
                const actCount =
                  itin.days?.reduce((acc, d) => acc + (d.items?.length ?? 0), 0) ?? 0;
                return (
                  <div
                    key={itin.id}
                    className={`flex w-full rounded-xl border transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/25 hover:bg-secondary/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedItinId(itin.id)}
                      aria-current={selected ? 'true' : undefined}
                      className="min-w-0 flex-1 p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    >
                      <p className="line-clamp-2 font-semibold text-foreground">{itin.title}</p>
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
                        <span className="line-clamp-2">{loc}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            itin.status === 'DRAFT'
                              ? 'bg-secondary text-muted-foreground'
                              : itin.status === 'SENT'
                                ? 'bg-sky-500/15 text-sky-400'
                                : itin.status === 'APPROVED'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-destructive/15 text-destructive'
                          }`}
                        >
                          {statusLabels[itin.status]}
                        </span>
                        <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {dayCount} days · {actCount} stops
                        </span>
                        {selected && (
                          <span className="text-[10px] font-medium text-primary">Selected</span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-stretch border-l border-border/60 py-2 pr-2 pl-1">
                      <button
                        type="button"
                        title="Delete itinerary"
                        aria-label={`Delete itinerary: ${itin.title}`}
                        onClick={(e) => handleDeleteSidebarItinerary(itin, e)}
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* —— Main editor —— */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background/30">
          {activeItinerary ? (
            <>
              <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <input
                    type="text"
                    value={activeItinerary.title}
                    onChange={(e) => updateItinerary(activeItinerary.id, { title: e.target.value })}
                    className="w-full border-none bg-transparent text-xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                    placeholder="Itinerary title"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 sm:max-w-md">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <input
                        type="text"
                        value={activeItinerary.description}
                        onChange={(e) =>
                          updateItinerary(activeItinerary.id, { description: e.target.value })
                        }
                        className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-muted-foreground focus:outline-none"
                        placeholder="Primary destination or region"
                      />
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {statusLabels[activeItinerary.status]}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total (client)
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-400">
                      ₹{Number(activeItinerary.totalPrice).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Items ₹{baseSellingTotal.toLocaleString('en-IN')} + markup & tax
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveItinerary}
                      disabled={savingItinerary || !activeItineraryDirty}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {savingItinerary ? 'Saving…' : activeItineraryDirty ? 'Save changes' : 'Saved'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <Printer className="h-4 w-4" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <details className="rounded-xl border border-border bg-card open:shadow-sm">
                  <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      Pricing, status & presentation
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Markup (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={activeItinerary.markupMargin}
                            onChange={(e) =>
                              updateItinerary(activeItinerary.id, {
                                markupMargin: Number(e.target.value),
                              })
                            }
                            className="w-full rounded-lg border border-border bg-secondary py-2 pr-8 pl-3 text-right text-xs font-semibold focus:outline-none"
                          />
                          <Percent className="absolute right-3 top-2.5 h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Tax (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={activeItinerary.taxRate}
                            onChange={(e) =>
                              updateItinerary(activeItinerary.id, { taxRate: Number(e.target.value) })
                            }
                            className="w-full rounded-lg border border-border bg-secondary py-2 pr-8 pl-3 text-right text-xs font-semibold focus:outline-none"
                          />
                          <Percent className="absolute right-3 top-2.5 h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Trip status
                        </label>
                        <select
                          value={activeItinerary.status}
                          onChange={(e) =>
                            updateItinerary(activeItinerary.id, {
                              status: e.target.value as Itinerary['status'],
                            })
                          }
                          className="w-full rounded-lg border border-border bg-secondary py-2 px-3 text-xs font-semibold focus:outline-none"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent to client</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </div>
                    </div>
                    <ProposalThemePicker value={proposalTheme} onChange={handleProposalThemeChange} />
                    {clientProfile && (
                      <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-[11px]">
                        <span className="font-bold text-muted-foreground">Traveller </span>
                        <span className="font-semibold text-foreground">
                          {clientProfile.firstName} {clientProfile.lastName}
                        </span>
                        <span className="text-muted-foreground"> · {clientProfile.email}</span>
                      </div>
                    )}
                    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-[11px] text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Items subtotal</span>
                        <span className="font-semibold text-foreground">
                          ₹{baseSellingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span>After markup (+{activeItinerary.markupMargin}%)</span>
                        <span className="font-semibold text-foreground">
                          ₹
                          {(
                            baseSellingTotal *
                            (1 + Number(activeItinerary.markupMargin) / 100)
                          ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </details>

                <div key={`schedule-${activeItinerary.id}-${activeItinerary.days?.length ?? 0}`} className="space-y-3">
                  {(activeItinerary.days ?? []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-[11px] text-muted-foreground">
                      <p>
                        No days yet — add a day to attach activities, or{' '}
                        <span className="font-semibold text-foreground">AI Generate</span> to scaffold a draft.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddDay}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-bold text-foreground hover:bg-secondary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add day
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Trip days
                      </p>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                        <label className="sr-only" htmlFor={`schedule-day-${activeItinerary.id}`}>
                          Working day
                        </label>
                        <select
                          id={`schedule-day-${activeItinerary.id}`}
                          value={scheduleDayId}
                          onChange={(e) => setScheduleDayId(e.target.value)}
                          title={
                            selectedScheduleDay
                              ? `₹${selectedScheduleDay.items
                                  .reduce((s, i) => s + Number(i.sellingPrice), 0)
                                  .toLocaleString('en-IN')} · ${selectedScheduleDay.items.length} ${
                                  selectedScheduleDay.items.length === 1 ? 'activity' : 'activities'
                                }`
                              : undefined
                          }
                          className="h-9 min-w-[8.5rem] max-w-[14rem] shrink-0 truncate rounded-lg border border-border bg-secondary px-3 pr-9 text-xs font-semibold focus:outline-none"
                        >
                          {(activeItinerary.days ?? []).map((day) => {
                            const short =
                              day.title.replace(/^Day\s*\d+:?\s*/i, '').trim() || day.title || 'Untitled';
                            return (
                              <option key={day.id} value={day.id}>
                                Day {day.dayNumber} · {short}
                              </option>
                            );
                          })}
                        </select>

                        <label className="sr-only" htmlFor={`day-title-${activeItinerary.id}`}>
                          Day title
                        </label>
                        <input
                          id={`day-title-${activeItinerary.id}`}
                          type="text"
                          disabled={!selectedScheduleDay}
                          value={selectedScheduleDay?.title ?? ''}
                          onChange={(e) =>
                            selectedScheduleDay &&
                            updateItineraryDay(activeItinerary.id, selectedScheduleDay.id, {
                              title: e.target.value,
                            })
                          }
                          placeholder="Day title"
                          className="h-9 min-w-0 flex-1 basis-[12rem] rounded-lg border border-border bg-secondary/40 px-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        />

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={!selectedScheduleDay}
                            title="Open form to create a new segment on this day"
                            onClick={() => {
                              setEditingItemCtx(null);
                              if (selectedScheduleDay) {
                                setShowAddItemModal({ dayId: selectedScheduleDay.id });
                              }
                            }}
                            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-95 disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            Add activity
                          </button>
                          <button
                            type="button"
                            disabled={!selectedScheduleDay}
                            onClick={() =>
                              selectedScheduleDay &&
                              deleteItineraryDay(activeItinerary.id, selectedScheduleDay.id)
                            }
                            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-destructive/40 px-3 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
                            title="Delete this day"
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            Delete day
                          </button>
                          <button
                            type="button"
                            onClick={handleAddDay}
                            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground hover:bg-secondary"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            Add day
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 w-full min-w-0 space-y-1.5">
                        <label
                          htmlFor={`day-overview-${activeItinerary.id}`}
                          className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                        >
                          Day overview
                        </label>
                        <textarea
                          id={`day-overview-${activeItinerary.id}`}
                          rows={3}
                          disabled={!selectedScheduleDay}
                          value={selectedScheduleDay?.description ?? ''}
                          onChange={(e) =>
                            selectedScheduleDay &&
                            updateItineraryDay(activeItinerary.id, selectedScheduleDay.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Summary for this day — appears in client preview beside the timeline"
                          className="w-full resize-y rounded-lg border border-border bg-secondary/30 px-3 py-2 text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-h-[4rem]"
                        />
                      </div>

                      {/* Inline activity CRUD — no need to open the modal only to change or drop a segment */}
                      {selectedScheduleDay && (
                        <div className="mt-3 rounded-xl border border-border/70 bg-secondary/15 p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Day activities ({(selectedScheduleDay.items ?? []).length})
                            </p>
                          </div>
                          {(selectedScheduleDay.items ?? []).length === 0 ? (
                            <p className="text-[11px] italic text-muted-foreground">
                              Nothing scheduled yet — use <span className="font-semibold not-italic text-foreground">Add activity</span> above.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {(selectedScheduleDay.items ?? []).map((item) => (
                                <li
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/70 px-2.5 py-2 text-[11px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-foreground">{item.title}</span>
                                    <span className="ml-2 text-[9px] font-bold uppercase text-muted-foreground">
                                      {item.type.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-semibold tabular-nums text-emerald-500">
                                    ₹{Number(item.sellingPrice).toLocaleString('en-IN')}
                                  </span>
                                  <div className="flex w-full shrink-0 justify-end gap-2 border-t border-border/40 pt-1.5 sm:w-auto sm:border-t-0 sm:pt-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItemCtx({ dayId: selectedScheduleDay.id, item });
                                        setShowAddItemModal({ dayId: selectedScheduleDay.id });
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary"
                                    >
                                      <Pencil className="h-3 w-3 shrink-0" aria-hidden />
                                      Change
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!window.confirm('Remove this activity from this day?')) return;
                                        deleteItineraryItem(activeItinerary.id, selectedScheduleDay.id, item.id);
                                        if (
                                          editingItemCtx?.dayId === selectedScheduleDay.id &&
                                          editingItemCtx.item.id === item.id
                                        ) {
                                          setEditingItemCtx(null);
                                          setItemTitle('');
                                          setItemDetails('');
                                          setItemCost('');
                                          setItemSelling('');
                                          setItemType('HOTEL');
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
                                      Remove
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <details className="no-print rounded-xl border border-border bg-card open:shadow-sm" open>
                  <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-2">
                      Client preview
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </span>
                  </summary>
                  <div className="border-t border-border p-4">
                    <ClientProposalView
                      id="itinerary-preview-element"
                      itinerary={activeItinerary}
                      themeId={proposalTheme}
                      agencyName={currentAgency.name}
                      agencyLogoUrl={currentAgency.logoUrl}
                      clientName={clientName}
                      showPricing
                    />
                  </div>
                </details>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center text-muted-foreground">
              <Compass className="h-10 w-10 opacity-40" />
              <p className="max-w-sm text-[13px]">
                {crmItineraryIntent?.leadId
                  ? 'Use New Itinerary or AI Generate in the sidebar to create this trip — it appears in the list after you finish.'
                  : 'Select an itinerary from the list or create a new one to start editing days and activities.'}
              </p>
            </div>
          )}
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
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl space-y-4 animate-scale-in text-xs">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="text-sm font-bold">
                {editingItemCtx ? 'Edit activity' : 'Add activity'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingItemCtx(null);
                  setShowAddItemModal(null);
                }}
                className="p-1 rounded hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {itemModalDay && itemModalDay.items.length > 0 && (
              <div className="space-y-2 border-b border-border pb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Activities on this day
                </p>
                <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {itemModalDay.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 leading-snug text-foreground">{item.title}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-emerald-500">
                        ₹{Number(item.sellingPrice).toLocaleString('en-IN')}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingItemCtx({ dayId: itemModalDay.id, item })}
                          className="text-primary underline decoration-primary/40 underline-offset-2 hover:no-underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteItineraryItem(activeItinerary.id, itemModalDay.id, item.id);
                            if (
                              editingItemCtx?.dayId === itemModalDay.id &&
                              editingItemCtx.item.id === item.id
                            ) {
                              setEditingItemCtx(null);
                              setItemTitle('');
                              setItemDetails('');
                              setItemCost('');
                              setItemSelling('');
                              setItemType('HOTEL');
                            }
                          }}
                          className="text-destructive underline decoration-destructive/40 underline-offset-2 hover:no-underline"
                        >
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Segment Type
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItineraryItem['type'])}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  >
                    <option value="FLIGHT">Flight Ticket</option>
                    <option value="HOTEL">Hotel Stay</option>
                    <option value="TRANSFER">Vehicle Transfer</option>
                    <option value="ACTIVITY">Excursion Activity</option>
                    <option value="MEAL">Meal / dining</option>
                    <option value="NOTE">Custom Note</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Title (optional time prefix)
                  </label>
                  <input
                    type="text"
                    required
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="e.g. 09:00 AM — Airport arrival"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Details · line 1 = location (shown with pin)
                </label>
                <textarea
                  required
                  value={itemDetails}
                  onChange={(e) => setItemDetails(e.target.value)}
                  placeholder="Venue line first, then description (new line)."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none resize-y min-h-[4rem]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Vendor Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    placeholder="14000"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={itemSelling}
                    onChange={(e) => setItemSelling(e.target.value)}
                    placeholder="16800"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemCtx(null);
                    setShowAddItemModal(null);
                  }}
                  className="px-4 py-2 rounded-lg hover:bg-secondary border border-border font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {editingItemCtx ? 'Save changes' : 'Add activity'}
                </button>
              </div>
            </form>
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
                  Branded link with your selected presentation theme
                </p>
              </div>
              <button type="button" onClick={() => setShowShareModal(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <ProposalThemePicker value={proposalTheme} onChange={handleProposalThemeChange} />

            <div className="rounded-xl overflow-hidden border border-border">
              <ClientProposalView
                itinerary={activeItinerary}
                themeId={proposalTheme}
                agencyName={currentAgency.name}
                agencyLogoUrl={currentAgency.logoUrl}
                clientName={clientName}
                showPricing
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
                  alert('Share link copied to clipboard!');
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
                    Builds a new trip with sample segments you can rename, price, and edit from{' '}
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
                  Destination
                </label>
                <input
                  id="ai-destination"
                  type="text"
                  value={aiDestination}
                  onChange={(e) => setAiDestination(e.target.value)}
                  placeholder="e.g. Kyoto, Japan"
                  disabled={aiGenerating}
                  className="w-full rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
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
                    const raw = Number(e.target.value);
                    if (!Number.isFinite(raw)) {
                      setAiNumDays(5);
                      return;
                    }
                    setAiNumDays(Math.min(14, Math.max(1, Math.floor(raw))));
                  }}
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
