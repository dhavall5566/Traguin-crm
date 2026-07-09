export type LeadPriority = 'HOT' | 'WARM' | 'COLD';

export const LEAD_PRIORITY_OPTIONS: ReadonlyArray<{
  value: LeadPriority;
  label: string;
}> = [
  { value: 'HOT', label: 'Hot' },
  { value: 'WARM', label: 'Warm' },
  { value: 'COLD', label: 'Cold' },
];

const LEGACY_PRIORITY_MAP: Record<string, LeadPriority> = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD',
  HIGH: 'HOT',
  MEDIUM: 'WARM',
  LOW: 'COLD',
};

export function normalizeLeadPriority(
  value: string | null | undefined,
): LeadPriority | undefined {
  if (!value?.trim()) return undefined;
  return LEGACY_PRIORITY_MAP[value.trim().toUpperCase()];
}

export function leadPriorityLabel(value: string | null | undefined): string {
  const normalized = normalizeLeadPriority(value);
  if (!normalized) return 'Not set';
  return LEAD_PRIORITY_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}
