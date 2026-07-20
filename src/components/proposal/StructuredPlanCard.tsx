'use client';

import React from 'react';

interface StructuredPlanCardProps {
  category: string;
  places: string;
  compact?: boolean;
  className?: string;
}

export function StructuredPlanCard({
  category,
  places,
  compact = false,
  className = '',
}: StructuredPlanCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      <p
        className={`font-bold uppercase tracking-widest text-amber-700 ${
          compact ? 'text-[8px]' : 'text-[9px]'
        }`}
      >
        {category}
      </p>
      <p
        className={`mt-0.5 leading-snug text-slate-800 ${
          compact ? 'text-[10px]' : 'text-[11px]'
        }`}
      >
        {places}
      </p>
    </div>
  );
}
