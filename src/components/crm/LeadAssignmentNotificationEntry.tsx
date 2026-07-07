'use client';

import React from 'react';
import { formatLeadDisplayCode } from '@/lib/lead-codes';
import type { LeadAssignmentPending } from '@/lib/api/leads';

type LeadAssignmentNotificationEntryProps = {
  item: LeadAssignmentPending;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function LeadAssignmentNotificationEntry({
  item,
  busy,
  onAccept,
  onReject,
}: LeadAssignmentNotificationEntryProps) {
  const code = formatLeadDisplayCode({ leadCode: item.leadCode, id: item.id });
  const name = `${item.firstName} ${item.lastName}`.trim();
  const assigner = item.assignedByName || 'Admin';

  return (
    <div className="crm-notif-item crm-notif-item--assignment">
      <span className="crm-notif-item__avatar crm-notif-item__avatar--assignment" aria-hidden>
        !
      </span>
      <div className="crm-notif-item__body">
        <div className="crm-notif-item__top">
          <span className="crm-notif-item__actor">Lead assignment</span>
          <span className="crm-notif-item__badge crm-notif-item__badge--update">Action required</span>
        </div>
        <p className="crm-notif-item__detail">
          <strong>{code}</strong> — {name}
          {item.title ? ` · ${item.title}` : ''}
        </p>
        <p className="crm-notif-item__sub">Assigned by {assigner}</p>
        <div className="crm-notif-assignment-actions">
          <button
            type="button"
            className="crm-notif-assignment-actions__accept"
            disabled={busy}
            onClick={onAccept}
          >
            Accept
          </button>
          <button
            type="button"
            className="crm-notif-assignment-actions__reject"
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
