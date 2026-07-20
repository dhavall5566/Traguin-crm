/** Lead & customer ID suffix legend — keep in sync with api/utils/lead_codes.py */

export const LEAD_SOURCE_ABBREV_LEGEND: ReadonlyArray<readonly [string, string]> = [
  ['WEB', 'Website'],
  ['FB', 'Facebook'],
  ['IG', 'Instagram'],
  ['GA', 'Google Ads'],
  ['GB', 'Google Business'],
  ['WA', 'WhatsApp'],
  ['REF', 'Referral'],
  ['RP', 'Existing / repeat'],
  ['WI', 'Walk-in'],
  ['CP', 'Corporate'],
  ['CM', 'Club members'],
  ['TW', 'Travel partners'],
  ['IN', 'Influencers'],
  ['PC', 'Phone call'],
  ['EM', 'Email'],
  ['LP', 'Landing page'],
  ['OC', 'Offline campaign'],
  ['IT', 'Itinerary inquiry'],
  ['TP', 'Travel planner'],
  ['HB', 'Hotel booking'],
  ['CC', 'Contact form'],
  ['TE', 'Expert consultation'],
  ['PJ', 'Plan my journey'],
  ['MN', 'Manual CRM entry'],
  ['DR', 'Direct / other'],
  ['RF', 'Referral (legacy)'],
  ['WB', 'Website (legacy)'],
] as const;

const LEGEND_BY_CODE = new Map<string, string>(
  LEAD_SOURCE_ABBREV_LEGEND.map(([code, label]) => [code, label]),
);

const TEMP_CODE_RE = /^TEMP\d{12}-([A-Z0-9]{2,3})$/;
const LEGACY_TRG_RE = /^TRG\d+-([A-Z0-9]{2,3})$/;
const CUSTOMER_CODE_RE = /^TG\d{10}$/;

/** Display helper for CRM lead inquiry IDs (TEMP… or legacy TRG…). */
export function formatLeadDisplayCode(lead: {
  id: string;
  leadCode?: string | null;
}): string {
  const code = lead.leadCode?.trim();
  if (code) return code;
  return lead.id.slice(0, 8).toUpperCase();
}

export function formatCustomerDisplayCode(customer: {
  id: string;
  customerCode?: string | null;
}): string {
  const code = customer.customerCode?.trim();
  if (code) return code;
  return customer.id.slice(0, 8).toUpperCase();
}

export function leadCodeSuffix(leadCode: string | null | undefined): string | null {
  const code = leadCode?.trim();
  if (!code) return null;
  const temp = TEMP_CODE_RE.exec(code);
  if (temp) return temp[1];
  const legacy = LEGACY_TRG_RE.exec(code);
  if (legacy) return legacy[1];
  if (!code.includes('-')) return null;
  return code.split('-').pop()?.toUpperCase() ?? null;
}

export function isTempLeadCode(code: string | null | undefined): boolean {
  return Boolean(code?.trim() && TEMP_CODE_RE.test(code.trim()));
}

export function isCustomerPermanentCode(code: string | null | undefined): boolean {
  return Boolean(code?.trim() && CUSTOMER_CODE_RE.test(code.trim()));
}

export function abbrevLegendLabel(abbrev: string | null | undefined): string | null {
  if (!abbrev) return null;
  return LEGEND_BY_CODE.get(abbrev.trim().toUpperCase()) ?? null;
}

export function leadCodeLegendHint(leadCode: string | null | undefined): string | null {
  const suffix = leadCodeSuffix(leadCode);
  if (!suffix) return null;
  const label = abbrevLegendLabel(suffix);
  if (isTempLeadCode(leadCode)) {
    return label ? `Inquiry · ${suffix} = ${label}` : `Inquiry · ${suffix}`;
  }
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
