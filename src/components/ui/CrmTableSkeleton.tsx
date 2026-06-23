'use client';

import React from 'react';

type CrmTableSkeletonProps = {
  columns?: number;
  rows?: number;
  className?: string;
};

export function CrmTableSkeleton({
  columns = 5,
  rows = 6,
  className = '',
}: CrmTableSkeletonProps) {
  return (
    <div
      className={`crm-table-skeleton ${className}`.trim()}
      style={{ ['--crm-skeleton-cols' as string]: String(columns) }}
      aria-hidden
    >
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="crm-table-skeleton__row">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <div
              key={colIdx}
              className="crm-table-skeleton__cell"
              style={{ animationDelay: `${(rowIdx * columns + colIdx) * 45}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
