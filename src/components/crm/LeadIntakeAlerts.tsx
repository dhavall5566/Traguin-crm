'use client';

import { formatLeadDisplayCode } from '@/lib/lead-codes';
import type { LeadIntakeCheckResult } from '@/lib/api/leads';

type LeadIntakeAlertsProps = {
  check: LeadIntakeCheckResult | null;
  loading?: boolean;
  onOpenLead?: (leadId: string) => void;
  onUseCustomer?: (customerId: string) => void;
  compact?: boolean;
};

export function LeadIntakeAlerts({
  check,
  loading = false,
  onOpenLead,
  onUseCustomer,
  compact = false,
}: LeadIntakeAlertsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-2 text-[10px] text-muted-foreground">
        Checking for existing customers and duplicate leads…
      </div>
    );
  }

  if (!check) return null;

  const hasAlerts =
    check.existing_customer ||
    check.will_merge ||
    check.duplicate_leads.length > 0;

  if (!hasAlerts) return null;

  return (
    <div className={`space-y-2 ${compact ? '' : 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-3'}`}>
      {check.existing_customer ? (
        <div className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
          <p className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Existing customer
          </p>
          <p>
            {check.existing_customer.first_name} {check.existing_customer.last_name}
            {' · '}
            {check.existing_customer.email}
            {check.existing_customer.phone ? ` · ${check.existing_customer.phone}` : ''}
          </p>
          {onUseCustomer ? (
            <button
              type="button"
              className="mt-1 font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => onUseCustomer(check.existing_customer!.id)}
            >
              Use this customer profile
            </button>
          ) : null}
        </div>
      ) : null}

      {check.will_merge && check.canonical_lead ? (
        <div className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
          <p className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Duplicate lead — will merge
          </p>
          <p>
            Matching phone number on existing lead{' '}
            <strong>
              {formatLeadDisplayCode({
                leadCode: check.canonical_lead.lead_code ?? undefined,
                id: check.canonical_lead.id,
              })}
            </strong>
            {' '}({check.canonical_lead.title}, {check.canonical_lead.status.replace(/_/g, ' ')}).
            New inquiry will be added to that card instead of creating a duplicate.
          </p>
          {onOpenLead ? (
            <button
              type="button"
              className="mt-1 font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => onOpenLead(check.canonical_lead!.id)}
            >
              Open existing lead
            </button>
          ) : null}
        </div>
      ) : null}

      {!check.will_merge && check.duplicate_leads.length > 0 ? (
        <div className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
          <p className="font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Possible duplicate leads
          </p>
          <ul className="mt-1 space-y-1">
            {check.duplicate_leads.map((dup) => (
              <li key={dup.id}>
                {onOpenLead ? (
                  <button
                    type="button"
                    className="text-left font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => onOpenLead(dup.id)}
                  >
                    {formatLeadDisplayCode({ leadCode: dup.lead_code ?? undefined, id: dup.id })}
                  </button>
                ) : (
                  <span className="font-medium">
                    {formatLeadDisplayCode({ leadCode: dup.lead_code ?? undefined, id: dup.id })}
                  </span>
                )}
                {' — '}
                {dup.title} ({dup.status.replace(/_/g, ' ')})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
