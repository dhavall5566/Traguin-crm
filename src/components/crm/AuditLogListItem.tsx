'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { AuditLog } from '@/lib/store';
import {
  formatAuditLogDetails,
  getAuditNotificationHref,
  isAuditNotificationClickable,
} from '@/lib/audit-notification-routes';

type AuditLogListItemProps = {
  log: AuditLog;
  /** `full` = locale date+time; `short` = time only */
  timeFormat?: 'full' | 'short';
};

function formatTime(iso: string, timeFormat: 'full' | 'short'): string {
  const date = new Date(iso);
  if (timeFormat === 'short') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString();
}

export function AuditLogListItem({ log, timeFormat = 'full' }: AuditLogListItemProps) {
  const router = useRouter();
  const href = getAuditNotificationHref(log);
  const clickable = isAuditNotificationClickable(log);
  const shellClass = `crm-audit-item${clickable ? ' crm-audit-item--clickable' : ''}`;
  const timeLabel = formatTime(log.createdAt, timeFormat);

  const inner = (
    <>
      <div className="crm-audit-item__copy min-w-0">
        <div className="crm-audit-item__row">
          <span className="crm-audit-item__user">{log.userName}</span>
          <span className="crm-audit-item__action">{log.action}</span>
          {log.entityType ? (
            <span className="crm-audit-item__entity">{log.entityType}</span>
          ) : null}
        </div>
        <p className="crm-audit-item__detail">{formatAuditLogDetails(log.details)}</p>
      </div>
      <div className="crm-audit-item__aside">
        <time className="crm-audit-item__time" dateTime={log.createdAt}>
          {timeLabel}
        </time>
        {clickable ? <ArrowUpRight className="crm-audit-item__chevron" aria-hidden /> : null}
      </div>
    </>
  );

  if (!clickable || !href) {
    return <div className={shellClass}>{inner}</div>;
  }

  return (
    <button
      type="button"
      className={shellClass}
      onClick={() => router.push(href)}
      title={`Open ${log.entityType}`}
    >
      {inner}
    </button>
  );
}
