"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

type LeadIdLegendProps = {
  entries: ReadonlyArray<readonly [string, string]>;
};

export function LeadIdLegend({ entries }: LeadIdLegendProps) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="crm-lead-id-legend-wrap">
      <button
        type="button"
        className="crm-lead-id-legend__trigger"
        aria-expanded={open}
        aria-controls="lead-id-legend-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Lead ID key
        <span className="crm-lead-id-legend__count">{entries.length}</span>
        <ChevronDown
          className={`crm-lead-id-legend__chevron${open ? " crm-lead-id-legend__chevron--open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <aside
          id="lead-id-legend-panel"
          className="crm-lead-id-legend"
          aria-label="Lead ID abbreviation key"
        >
          <p className="crm-lead-id-legend__title">
            Lead IDs use <strong>TRG###-XX</strong> — sources in your pipeline:
          </p>
          <dl className="crm-lead-id-legend__grid">
            {entries.map(([code, label]) => (
              <div key={code} className="crm-lead-id-legend__item">
                <dt className="crm-lead-id-legend__code">{code}</dt>
                <dd className="crm-lead-id-legend__label">{label}</dd>
              </div>
            ))}
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
