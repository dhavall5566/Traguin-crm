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
      <div className="crm-intake-alert crm-intake-alert--loading">
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
    <div className={`crm-intake-alert ${compact ? 'crm-intake-alert--compact' : ''}`}>
      {check.existing_customer ? (
        <div className="crm-intake-alert__block">
          <p className="crm-intake-alert__title">Existing customer</p>
          <p className="crm-intake-alert__body">
            {check.existing_customer.first_name} {check.existing_customer.last_name}
            {' · '}
            {check.existing_customer.email}
            {check.existing_customer.phone ? ` · ${check.existing_customer.phone}` : ''}
          </p>
          {onUseCustomer ? (
            <button
              type="button"
              className="crm-intake-alert__action"
              onClick={() => onUseCustomer(check.existing_customer!.id)}
            >
              Use this customer profile
            </button>
          ) : null}
        </div>
      ) : null}

      {check.will_merge && check.canonical_lead ? (
        <div className="crm-intake-alert__block">
          <p className="crm-intake-alert__title">Duplicate lead — will merge</p>
          <p className="crm-intake-alert__body">
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
              className="crm-intake-alert__action"
              onClick={() => onOpenLead(check.canonical_lead!.id)}
            >
              Open existing lead
            </button>
          ) : null}
        </div>
      ) : null}

      {!check.will_merge && check.duplicate_leads.length > 0 ? (
        <div className="crm-intake-alert__block">
          <p className="crm-intake-alert__title">Possible duplicate leads</p>
          <ul className="crm-intake-alert__list">
            {check.duplicate_leads.map((dup) => (
              <li key={dup.id}>
                {onOpenLead ? (
                  <button
                    type="button"
                    className="crm-intake-alert__link"
                    onClick={() => onOpenLead(dup.id)}
                  >
                    {formatLeadDisplayCode({ leadCode: dup.lead_code ?? undefined, id: dup.id })}
                  </button>
                ) : (
                  <span className="crm-intake-alert__link-text">
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
