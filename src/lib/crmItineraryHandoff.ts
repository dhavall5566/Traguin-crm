/** Session keys for CRM → Itinerary → CRM “create itinerary for lead” round-trip */

export const STORAGE_CREATE_ITIN_FROM_CRM = 'travelcrm:createItineraryFromCrm';

export const STORAGE_CRM_RESUME_BOOKING = 'travelcrm:crmBookingResume';
/** Set only when the user clicks Assign on Trip planner — not on itinerary create. */

export type CrmBookingResumePayload = {
  leadId: string;
  itineraryId: string;
  itineraryTitle?: string;
  itineraryTotalPrice?: number;
};

export type CrmItineraryCreationIntent = {
  leadId: string;
  /** Linked Directory customer ID when known; empty if lead has no traveller yet */
  customerId: string;
  /** From CRM “Lead Goal / Destination Title” (`Lead.title`) at handoff time */
  leadGoalTitle: string;
  /** Customer inquiry text (`Lead.message`) — prefills AI itinerary title */
  leadMessage: string;
};

/** Safe parse — used when React state/ref may reset (Strict Mode) but session keys must survive. */
export function readCrmBookingResumeFromStorage(): CrmBookingResumePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_CRM_RESUME_BOOKING);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CrmBookingResumePayload>;
    const leadId = typeof parsed.leadId === 'string' ? parsed.leadId.trim() : '';
    const itineraryId = typeof parsed.itineraryId === 'string' ? parsed.itineraryId.trim() : '';
    if (!leadId || !itineraryId) return null;
    const itineraryTitle =
      typeof parsed.itineraryTitle === 'string' ? parsed.itineraryTitle.trim() : undefined;
    const rawPrice = parsed.itineraryTotalPrice as unknown;
    const itineraryTotalPrice =
      typeof rawPrice === 'number' && Number.isFinite(rawPrice)
        ? rawPrice
        : typeof rawPrice === 'string' && rawPrice.trim() && Number.isFinite(Number(rawPrice))
          ? Number(rawPrice)
          : undefined;
    return { leadId, itineraryId, itineraryTitle, itineraryTotalPrice };
  } catch {
    return null;
  }
}

/** Read booking-resume payload once and remove it so list refreshes cannot re-open tabs. */
export function consumeCrmBookingResumeFromStorage(): CrmBookingResumePayload | null {
  const resume = readCrmBookingResumeFromStorage();
  if (!resume) return null;
  try {
    sessionStorage.removeItem(STORAGE_CRM_RESUME_BOOKING);
  } catch {
    /* quota / blocked */
  }
  return resume;
}

/** Safe parse — used when React state/ref may reset (Strict Mode) but session keys must survive. */
export function readCrmItineraryCreationIntentFromStorage(): CrmItineraryCreationIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_CREATE_ITIN_FROM_CRM);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CrmItineraryCreationIntent>;
    const leadId = typeof parsed.leadId === 'string' ? parsed.leadId.trim() : '';
    if (!leadId) return null;
    return {
      leadId,
      customerId: typeof parsed.customerId === 'string' ? parsed.customerId.trim() : '',
      leadGoalTitle:
        typeof parsed.leadGoalTitle === 'string' ? parsed.leadGoalTitle.trim() : '',
      leadMessage:
        typeof parsed.leadMessage === 'string' ? parsed.leadMessage.trim() : '',
    };
  } catch {
    return null;
  }
}

/** Call when the CRM↔builder round-trip is completed or deliberately abandoned */
export function clearCrmItineraryCreationIntentFromStorage() {
  try {
    sessionStorage.removeItem(STORAGE_CREATE_ITIN_FROM_CRM);
  } catch {
    /* ignore */
  }
}
