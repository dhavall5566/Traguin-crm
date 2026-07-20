'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  computePricingBreakdown,
  markupForTargetTotal,
} from '@/lib/api/itineraries';

function parseInrInput(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatInr(value: number, fractionDigits = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatInrCompact(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function parsePercentDraft(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampPercent(parsed) : fallback;
}

interface ClientPricingPanelProps {
  itemsSubtotal: number;
  markupMargin: number;
  taxRate: number;
  discountRate: number;
  showDiscount: boolean;
  onChange: (patch: {
    markupMargin?: number;
    taxRate?: number;
    discountRate?: number;
  }) => void;
}

export default function ClientPricingPanel({
  itemsSubtotal,
  markupMargin,
  taxRate,
  discountRate,
  showDiscount,
  onChange,
}: ClientPricingPanelProps) {
  const totalId = useId();
  const markupId = useId();
  const taxId = useId();
  const discountId = useId();

  const [markupDraft, setMarkupDraft] = useState(String(markupMargin ?? 0));
  const [taxDraft, setTaxDraft] = useState(String(taxRate ?? 0));
  const [discountDraft, setDiscountDraft] = useState(String(discountRate ?? 0));
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');

  const liveMarkup = parsePercentDraft(markupDraft, markupMargin ?? 0);
  const liveTax = parsePercentDraft(taxDraft, taxRate ?? 0);
  const liveDiscount = showDiscount
    ? parsePercentDraft(discountDraft, discountRate ?? 0)
    : 0;

  const breakdown = useMemo(
    () => computePricingBreakdown(itemsSubtotal, liveMarkup, liveTax, liveDiscount),
    [itemsSubtotal, liveMarkup, liveTax, liveDiscount],
  );

  useEffect(() => {
    setMarkupDraft(String(markupMargin ?? 0));
  }, [markupMargin]);

  useEffect(() => {
    setTaxDraft(String(taxRate ?? 0));
  }, [taxRate]);

  useEffect(() => {
    setDiscountDraft(String(discountRate ?? 0));
  }, [discountRate]);

  useEffect(() => {
    if (!editingTotal) {
      setTotalDraft(formatInr(breakdown.total));
    }
  }, [breakdown.total, editingTotal]);

  const commitTotal = () => {
    setEditingTotal(false);
    const parsed = parseInrInput(totalDraft);
    if (parsed == null) {
      setTotalDraft(formatInr(breakdown.total));
      return;
    }
    const nextMarkup = markupForTargetTotal(
      itemsSubtotal,
      liveTax,
      parsed,
      liveDiscount,
    );
    const clampedMarkup = Math.max(0, nextMarkup);
    setMarkupDraft(String(clampedMarkup));
    onChange({ markupMargin: clampedMarkup });
  };

  const handleMarkupChange = (raw: string) => {
    setMarkupDraft(raw);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange({ markupMargin: clampPercent(parsed) });
  };

  const handleTaxChange = (raw: string) => {
    setTaxDraft(raw);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange({ taxRate: clampPercent(parsed) });
  };

  const handleDiscountChange = (raw: string) => {
    setDiscountDraft(raw);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange({ discountRate: clampPercent(parsed) });
  };

  const commitMarkup = () => {
    const clamped = parsePercentDraft(markupDraft, markupMargin ?? 0);
    setMarkupDraft(String(clamped));
    onChange({ markupMargin: clamped });
  };

  const commitTax = () => {
    const clamped = parsePercentDraft(taxDraft, taxRate ?? 0);
    setTaxDraft(String(clamped));
    onChange({ taxRate: clamped });
  };

  const commitDiscount = () => {
    const clamped = parsePercentDraft(discountDraft, discountRate ?? 0);
    setDiscountDraft(String(clamped));
    onChange({ discountRate: clamped });
  };

  const displayTotal = editingTotal ? totalDraft : formatInr(breakdown.total);

  return (
    <section className="crm-itin-pricing-panel" aria-label="Client pricing breakdown">
      <div className="crm-itin-pricing-panel__head">
        <div>
          <h3 className="crm-itin-pricing-panel__title">Client pricing</h3>
          <p className="crm-itin-pricing-panel__hint">
            Adjust markup, tax{showDiscount ? ', and admin discount' : ''} — totals update live.
          </p>
        </div>
        <label className="crm-itin-total__amount" htmlFor={totalId}>
          <span className="crm-itin-total__currency" aria-hidden>
            ₹
          </span>
          <input
            id={totalId}
            type="text"
            inputMode="decimal"
            className="crm-itin-total__value-input"
            value={displayTotal}
            onChange={(e) => {
              setEditingTotal(true);
              setTotalDraft(e.target.value);
            }}
            onFocus={() => {
              setEditingTotal(true);
              setTotalDraft(formatInr(breakdown.total));
            }}
            onBlur={commitTotal}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Client total amount"
          />
        </label>
      </div>

      <div className="crm-itin-total__breakdown crm-itin-pricing-panel__breakdown">
        <div className="crm-itin-total__row">
          <span className="crm-itin-total__row-label">Items</span>
          <span className="crm-itin-total__row-value">₹{formatInrCompact(itemsSubtotal)}</span>
        </div>

        {showDiscount ? (
          <div className="crm-itin-total__row crm-itin-total__row--edit">
            <span className="crm-itin-total__row-label" id={`${discountId}-label`}>
              Discount
            </span>
            <div className="crm-itin-total__pct-field">
              <input
                id={discountId}
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="crm-itin-total__pct-input"
                value={discountDraft}
                onChange={(e) => handleDiscountChange(e.target.value)}
                onBlur={commitDiscount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                aria-labelledby={`${discountId}-label`}
              />
              <span className="crm-itin-total__pct-suffix">%</span>
            </div>
            <span className="crm-itin-total__row-delta crm-itin-total__row-delta--neg">
              −₹{formatInrCompact(breakdown.discountAmount)}
            </span>
          </div>
        ) : null}

        <div className="crm-itin-total__row crm-itin-total__row--edit">
          <span className="crm-itin-total__row-label" id={`${markupId}-label`}>
            Markup
          </span>
          <div className="crm-itin-total__pct-field">
            <input
              id={markupId}
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="crm-itin-total__pct-input"
              value={markupDraft}
              onChange={(e) => handleMarkupChange(e.target.value)}
              onBlur={commitMarkup}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-labelledby={`${markupId}-label`}
            />
            <span className="crm-itin-total__pct-suffix">%</span>
          </div>
          <span className="crm-itin-total__row-delta">+₹{formatInrCompact(breakdown.markupAmount)}</span>
        </div>

        <div className="crm-itin-total__row crm-itin-total__row--edit">
          <span className="crm-itin-total__row-label" id={`${taxId}-label`}>
            Tax
          </span>
          <div className="crm-itin-total__pct-field">
            <input
              id={taxId}
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="crm-itin-total__pct-input"
              value={taxDraft}
              onChange={(e) => handleTaxChange(e.target.value)}
              onBlur={commitTax}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-labelledby={`${taxId}-label`}
            />
            <span className="crm-itin-total__pct-suffix">%</span>
          </div>
          <span className="crm-itin-total__row-delta">+₹{formatInrCompact(breakdown.taxAmount)}</span>
        </div>

        <div className="crm-itin-total__row crm-itin-total__row--total">
          <span className="crm-itin-total__row-label">Client total</span>
          <span className="crm-itin-total__row-value">₹{formatInr(breakdown.total)}</span>
        </div>
      </div>
    </section>
  );
}
