/**
 * Lead pipeline stages — Travel CRM Lead Flow Guide v4.2
 * New → Assigned → Accepted → Contacted → Itinerary → Approved → Quote → Booked → Paid → Ready → Closed | Dump
 */

export const LEAD_PIPELINE_STAGES = [
  { id: 'NEW', name: 'New', color: 'border-t-slate-500 bg-slate-500/5', bar: 'bg-slate-500', top: 'border-t-slate-500' },
  { id: 'ASSIGNED', name: 'Assigned', color: 'border-t-amber-500 bg-amber-500/5', bar: 'bg-amber-500', top: 'border-t-amber-500' },
  { id: 'ACCEPTED', name: 'Accepted', color: 'border-t-blue-500 bg-blue-500/5', bar: 'bg-blue-500', top: 'border-t-blue-500' },
  { id: 'CONTACTED', name: 'Contacted', color: 'border-t-sky-500 bg-sky-500/5', bar: 'bg-sky-500', top: 'border-t-sky-500' },
  {
    id: 'ITINERARY_SENT',
    name: 'Itinerary Sent',
    color: 'border-t-indigo-500 bg-indigo-500/5',
    bar: 'bg-indigo-500',
    top: 'border-t-indigo-500',
  },
  { id: 'APPROVED', name: 'Customer Approved', color: 'border-t-violet-500 bg-violet-500/5', bar: 'bg-violet-500', top: 'border-t-violet-500' },
  { id: 'QUOTE_SENT', name: 'Quote Sent', color: 'border-t-pink-500 bg-pink-500/5', bar: 'bg-pink-500', top: 'border-t-pink-500' },
  { id: 'BOOKED', name: 'Booked', color: 'border-t-emerald-500 bg-emerald-500/5', bar: 'bg-emerald-500', top: 'border-t-emerald-500' },
  { id: 'PAID', name: 'Paid', color: 'border-t-teal-500 bg-teal-500/5', bar: 'bg-teal-500', top: 'border-t-teal-500' },
  { id: 'READY', name: 'Operations', color: 'border-t-cyan-500 bg-cyan-500/5', bar: 'bg-cyan-500', top: 'border-t-cyan-500' },
  { id: 'CLOSED', name: 'Closed', color: 'border-t-purple-500 bg-purple-500/5', bar: 'bg-purple-500', top: 'border-t-purple-500' },
  { id: 'DUMP_LEAD', name: 'Dump Lead', color: 'border-t-red-500 bg-red-500/5', bar: 'bg-red-500', top: 'border-t-red-500' },
] as const;

export type LeadPipelineStatus = (typeof LEAD_PIPELINE_STAGES)[number]['id'];

const PIPELINE_STATUS_SET = new Set<string>(LEAD_PIPELINE_STAGES.map((s) => s.id));

/** Legacy CRM statuses → v4.2 pipeline (read-time normalization). */
const LEGACY_STATUS_MAP: Record<string, LeadPipelineStatus> = {
  PROPOSAL_SENT: 'ITINERARY_SENT',
  NEGOTIATION: 'QUOTE_SENT',
  CONFIRMED: 'BOOKED',
  LOST: 'DUMP_LEAD',
};

export function isLeadPipelineStatus(value: string): value is LeadPipelineStatus {
  return PIPELINE_STATUS_SET.has(value);
}

export function resolvePipelineStage(status: string | null | undefined): LeadPipelineStatus {
  const raw = (status ?? '').trim().toUpperCase();
  if (!raw) return 'NEW';
  if (isLeadPipelineStatus(raw)) return raw;
  return LEGACY_STATUS_MAP[raw] ?? 'NEW';
}

export function leadMatchesStage(status: string, stageId: LeadPipelineStatus): boolean {
  return resolvePipelineStage(status) === stageId;
}

export function pipelineStageName(status: string): string {
  const id = resolvePipelineStage(status);
  return LEAD_PIPELINE_STAGES.find((s) => s.id === id)?.name ?? id;
}

export function pipelineStageBarClass(status: string): string {
  const id = resolvePipelineStage(status);
  return LEAD_PIPELINE_STAGES.find((s) => s.id === id)?.bar ?? 'bg-slate-500';
}

export function pipelineStageTopClass(status: string): string {
  const id = resolvePipelineStage(status);
  return LEAD_PIPELINE_STAGES.find((s) => s.id === id)?.top ?? 'border-t-slate-500';
}

/** Stages still in active sales / RM workflow (excludes won, ops-complete, and dump). */
export const ACTIVE_PIPELINE_STATUSES: LeadPipelineStatus[] = [
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'CONTACTED',
  'ITINERARY_SENT',
  'APPROVED',
  'QUOTE_SENT',
];

export function isActivePipelineStatus(status: string): boolean {
  return ACTIVE_PIPELINE_STATUSES.includes(resolvePipelineStage(status));
}

export function isItinerarySentStage(status: string): boolean {
  const resolved = resolvePipelineStage(status);
  return resolved === 'ITINERARY_SENT';
}

export function isWonPipelineStatus(status: string): boolean {
  const resolved = resolvePipelineStage(status);
  return resolved === 'BOOKED' || resolved === 'PAID' || resolved === 'READY' || resolved === 'CLOSED';
}

export function isLostPipelineStatus(status: string): boolean {
  return resolvePipelineStage(status) === 'DUMP_LEAD';
}

export const PIPELINE_STAGE_CHART_COLORS: Record<LeadPipelineStatus, string> = {
  NEW: '#64748b',
  ASSIGNED: '#f59e0b',
  ACCEPTED: '#3b82f6',
  CONTACTED: '#38bdf8',
  ITINERARY_SENT: '#6366f1',
  APPROVED: '#8b5cf6',
  QUOTE_SENT: '#ec4899',
  BOOKED: '#10b981',
  PAID: '#14b8a6',
  READY: '#06b6d4',
  CLOSED: '#a855f7',
  DUMP_LEAD: '#ef4444',
};

export const PIPELINE_STAGE_LABELS: Record<LeadPipelineStatus, string> = Object.fromEntries(
  LEAD_PIPELINE_STAGES.map((s) => [s.id, s.name]),
) as Record<LeadPipelineStatus, string>;

const CONTACT_ACTIVITY_TYPES = new Set(['PHONE', 'EMAIL', 'MEET']);

export function pipelineStageIndex(status: LeadPipelineStatus): number {
  return LEAD_PIPELINE_STAGES.findIndex((stage) => stage.id === status);
}

export function maxPipelineStage(...statuses: LeadPipelineStatus[]): LeadPipelineStatus {
  let best: LeadPipelineStatus = 'NEW';
  let bestIndex = 0;
  for (const status of statuses) {
    const index = pipelineStageIndex(status);
    if (index > bestIndex) {
      bestIndex = index;
      best = status;
    }
  }
  return best;
}

function stageFromStageChangeDescription(description?: string): LeadPipelineStatus | null {
  if (!description) return null;
  const upper = description.toUpperCase();
  let best: LeadPipelineStatus | null = null;
  let bestIndex = -1;
  for (const stage of LEAD_PIPELINE_STAGES) {
    if (upper.includes(stage.id)) {
      const index = pipelineStageIndex(stage.id);
      if (index > bestIndex) {
        bestIndex = index;
        best = stage.id;
      }
    }
  }
  for (const [legacy, modern] of Object.entries(LEGACY_STATUS_MAP)) {
    if (upper.includes(legacy)) {
      const index = pipelineStageIndex(modern);
      if (index > bestIndex) {
        bestIndex = index;
        best = modern;
      }
    }
  }
  return best;
}

export function inferPipelineStageFromLead(
  lead: {
    status?: string | null;
    assignedToId?: string | null;
    assignmentStatus?: string | null;
    proposalSentAt?: string | null;
    activities?: { type: string; description?: string }[];
    followups?: { status?: string }[];
  } | null,
): LeadPipelineStatus {
  if (!lead) return 'NEW';

  const candidates: LeadPipelineStatus[] = ['NEW'];

  if (lead.assignedToId) {
    candidates.push(lead.assignmentStatus === 'ACCEPTED' ? 'ACCEPTED' : 'ASSIGNED');
  }
  if (lead.proposalSentAt) {
    candidates.push('ITINERARY_SENT');
  }

  for (const activity of lead.activities ?? []) {
    const type = activity.type.toUpperCase();
    if (CONTACT_ACTIVITY_TYPES.has(type)) {
      candidates.push('CONTACTED');
    }
    if (type === 'ENTERED_PROPOSAL_SENT') {
      candidates.push('ITINERARY_SENT');
    }
    if (type === 'STAGE_CHANGE') {
      const fromHistory = stageFromStageChangeDescription(activity.description);
      if (fromHistory) candidates.push(fromHistory);
    }
  }

  for (const followup of lead.followups ?? []) {
    if ((followup.status ?? '').toUpperCase() === 'COMPLETED') {
      candidates.push('CONTACTED');
      break;
    }
  }

  return maxPipelineStage(...candidates);
}

/** Stage shown in the progress bar — never behind recorded activity signals. */
export function effectivePipelineStage(
  draftStatus: string | null | undefined,
  lead: Parameters<typeof inferPipelineStageFromLead>[0],
): LeadPipelineStatus {
  const draft = resolvePipelineStage(draftStatus);
  const inferred = inferPipelineStageFromLead(lead);
  if (draft === 'DUMP_LEAD' || draft === 'CLOSED') return draft;
  return maxPipelineStage(draft, inferred);
}
