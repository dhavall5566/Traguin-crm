/** Lead ID suffix legend — keep in sync with api/utils/lead_codes.py */

export const LEAD_SOURCE_ABBREV_LEGEND: ReadonlyArray<readonly [string, string]> = [
  ['WB', 'Website'],
  ['IT', 'Itinerary inquiry'],
  ['TP', 'Travel planner'],
  ['HB', 'Hotel booking'],
  ['CC', 'Contact form'],
  ['TE', 'Expert consultation'],
  ['PJ', 'Plan my journey'],
  ['WA', 'WhatsApp'],
  ['IG', 'Instagram / social ads'],
  ['RF', 'Referral'],
  ['MN', 'Manual CRM entry'],
  ['DR', 'Direct / other'],
] as const;

const LEGEND_BY_CODE = new Map<string, string>(
  LEAD_SOURCE_ABBREV_LEGEND.map(([code, label]) => [code, label]),
);

/** Display helper for CRM lead reference codes (TRG001-WA). */
export function formatLeadDisplayCode(lead: {
  id: string;
  leadCode?: string | null;
}): string {
  const code = lead.leadCode?.trim();
  if (code) return code;
  return lead.id.slice(0, 8).toUpperCase();
}

export function leadCodeSuffix(leadCode: string | null | undefined): string | null {
  const code = leadCode?.trim();
  if (!code || !code.includes('-')) return null;
  return code.split('-').pop()?.toUpperCase() ?? null;
}

export function abbrevLegendLabel(abbrev: string | null | undefined): string | null {
  if (!abbrev) return null;
  return LEGEND_BY_CODE.get(abbrev.trim().toUpperCase()) ?? null;
}

export function leadCodeLegendHint(leadCode: string | null | undefined): string | null {
  const suffix = leadCodeSuffix(leadCode);
  if (!suffix) return null;
  const label = abbrevLegendLabel(suffix);
  return label ? `${suffix} = ${label}` : null;
}

/** Legend rows for sources that appear in the current lead list. */
export function buildActiveLegendEntries(
  leads: ReadonlyArray<{ leadCode?: string | null; source?: string | null }>,
): Array<[string, string]> {
  const seen = new Map<string, string>();

  for (const lead of leads) {
    const suffix = leadCodeSuffix(lead.leadCode);
    if (!suffix || seen.has(suffix)) continue;
    const label = abbrevLegendLabel(suffix) ?? (lead.source?.trim() || 'Other source');
    seen.set(suffix, label);
  }

  return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
