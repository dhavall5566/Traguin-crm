const LOCAL_LEAD_MUTATION_MS = 8000;
const locallyMutatedLeadIds = new Map<string, number>();

export function markLeadLocallyMutated(leadId: string): void {
  locallyMutatedLeadIds.set(leadId, Date.now());
}

export function isLeadLocallyMutated(leadId: string): boolean {
  const ts = locallyMutatedLeadIds.get(leadId);
  if (!ts) return false;
  if (Date.now() - ts > LOCAL_LEAD_MUTATION_MS) {
    locallyMutatedLeadIds.delete(leadId);
    return false;
  }
  return true;
}

export function pruneLocalLeadMutations(): void {
  const now = Date.now();
  for (const [id, ts] of locallyMutatedLeadIds.entries()) {
    if (now - ts > LOCAL_LEAD_MUTATION_MS) locallyMutatedLeadIds.delete(id);
  }
}
