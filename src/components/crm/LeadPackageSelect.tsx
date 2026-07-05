"use client";

import { useEffect, useMemo, useState } from "react";
import { listCmsPackages, mapPackageListFromApi, type CmsPackageListRecord } from "@/lib/api/packages";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type LeadPackageSelectProps = {
  leadId: string;
  value: string | undefined;
  onChange: (packageId: string | undefined) => void;
  selectedLabel?: string;
};

export function LeadPackageSelect({
  leadId,
  value,
  onChange,
  selectedLabel,
}: LeadPackageSelectProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [options, setOptions] = useState<CmsPackageListRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void listCmsPackages({ q: debouncedQuery || undefined, limit: 40 })
      .then((response) => {
        if (cancelled) return;
        setOptions(response.items.map(mapPackageListFromApi));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const selectedOption = useMemo(
    () => options.find((item) => item.id === value),
    [options, value],
  );

  const displayLabel =
    selectedLabel ||
    selectedOption?.title ||
    (value ? "Linked package" : "No package linked");

  return (
    <div className="crm-lead-package-select">
      <label htmlFor={`lead-package-${leadId}`} className="crm-lead-drawer__field-label">
        CMS package
      </label>
      <div className="crm-lead-package-select__control">
        <input
          id={`lead-package-${leadId}`}
          type="text"
          value={open ? query : displayLabel}
          placeholder="Search packages…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="crm-lead-drawer__input w-full"
        />
        {value ? (
          <button
            type="button"
            className="crm-lead-package-select__clear"
            onClick={() => {
              onChange(undefined);
              setQuery("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="crm-lead-package-select__menu" role="listbox">
          {loading ? <p className="crm-lead-package-select__hint">Loading…</p> : null}
          {!loading && options.length === 0 ? (
            <p className="crm-lead-package-select__hint">No packages found.</p>
          ) : null}
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              className={`crm-lead-package-select__option${item.id === value ? " crm-lead-package-select__option--active" : ""}`}
              onClick={() => {
                onChange(item.id);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="crm-lead-package-select__option-title">{item.title}</span>
              <span className="crm-lead-package-select__option-meta">
                {item.destinationName} · {item.durationLabel} · ₹{item.price.toLocaleString("en-IN")}
                {!item.isPublished ? " · Internal" : " · Website"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
