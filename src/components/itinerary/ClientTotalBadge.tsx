'use client';

interface ClientTotalBadgeProps {
  total: number;
}

function formatInr(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ClientTotalBadge({ total }: ClientTotalBadgeProps) {
  return (
    <div className="crm-itin-total-badge" aria-label={`Client total ₹${formatInr(total)}`}>
      <span className="crm-itin-total-badge__label">Client total</span>
      <span className="crm-itin-total-badge__value">₹{formatInr(total)}</span>
    </div>
  );
}
