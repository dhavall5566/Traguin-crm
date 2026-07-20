type LeadDetailRouter = {
  push: (href: string) => void;
  back: () => void;
};

const LEAD_DETAIL_PREFIX = '/dashboard/crm/leads/';

/** Canonical href for a lead detail page (full-page view, not drawer). */
export function getLeadDetailHref(leadId: string): string {
  return `${LEAD_DETAIL_PREFIX}${leadId}`;
}

export function isLeadDetailPath(pathname: string): boolean {
  return pathname.startsWith(LEAD_DETAIL_PREFIX);
}

export function leadIdFromDetailPath(pathname: string): string | null {
  if (!isLeadDetailPath(pathname)) return null;
  const leadId = pathname.slice(LEAD_DETAIL_PREFIX.length).split('/')[0]?.trim();
  return leadId || null;
}

/**
 * Next.js App Router can replace the current history entry when navigating between
 * two dynamic lead routes. Push the current URL first so Back returns to the prior lead.
 */
function preserveLeadDetailHistoryEntry(): void {
  if (typeof window === 'undefined') return;
  window.history.pushState(window.history.state, '', window.location.href);
}

/** Navigate to a lead detail page, preserving browser history for lead-to-lead jumps. */
export function navigateToLeadDetail(
  router: LeadDetailRouter,
  leadId: string,
  currentPathname?: string,
): void {
  const target = getLeadDetailHref(leadId);
  const pathname =
    currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  const currentLeadId = leadIdFromDetailPath(pathname);
  if (currentLeadId && currentLeadId !== leadId) {
    preserveLeadDetailHistoryEntry();
  }

  router.push(target);
}

/** Leave lead detail — prefer browser back when history exists, else CRM list. */
export function leaveLeadDetailPage(router: LeadDetailRouter): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/dashboard/crm');
}
