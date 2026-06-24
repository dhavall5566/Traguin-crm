/** Session keys for CRM → Itinerary → CRM “create itinerary for lead” round-trip */

export const STORAGE_CREATE_ITIN_FROM_CRM = 'travelcrm:createItineraryFromCrm';

export const STORAGE_CRM_RESUME_BOOKING = 'travelcrm:crmBookingResume';

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
