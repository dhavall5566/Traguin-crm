"use client";

import { DatePickerInput } from "@/components/ui/DatePickerInput";
import type { LeadDetailsFields, LeadPackageMode, LeadYesNo } from "@/lib/lead-details";

type LeadDetailsFormProps = {
  leadId: string;
  value: LeadDetailsFields;
  onChange: (patch: Partial<LeadDetailsFields>) => void;
};

const PRE_BUILT_CLEARED_FIELDS: Partial<LeadDetailsFields> = {
  flightType: undefined,
  transportation: undefined,
  travelInsurance: undefined,
  occasion: undefined,
  hotelCategory: undefined,
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="crm-lead-drawer__field-label">
      {children}
    </label>
  );
}

function RadioGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  disabled = false,
}: {
  name: string;
  legend: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="crm-lead-details__radio-group" disabled={disabled}>
      <legend className="crm-lead-drawer__field-label">{legend}</legend>
      <div className="crm-lead-details__radio-options">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`crm-lead-details__radio-label${disabled ? " crm-lead-details__radio-label--disabled" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function YesNoRadio({
  name,
  legend,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  legend: string;
  value: LeadYesNo | undefined;
  onChange: (next: LeadYesNo) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      name={name}
      legend={legend}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={[
        { value: "YES", label: "Yes" },
        { value: "NO", label: "No" },
      ]}
    />
  );
}

export function LeadDetailsForm({ leadId, value, onChange }: LeadDetailsFormProps) {
  const childCount = Math.max(0, value.childrenCount ?? 0);
  const ages = value.childrenAges ?? [];
  const destination = (value.travelDestination ?? "").trim();
  const hasDestination = destination.length > 0;
  const isPreBuilt = value.packageMode === "PRE_BUILT";
  const hidePreBuiltFields = hasDestination && isPreBuilt;

  const setChildCount = (count: number) => {
    const next = Math.max(0, Math.min(20, count));
    const nextAges = [...ages];
    while (nextAges.length < next) nextAges.push(7);
    while (nextAges.length > next) nextAges.pop();
    onChange({ childrenCount: next || undefined, childrenAges: next ? nextAges : undefined });
  };

  const setChildAge = (index: number, age: number) => {
    const nextAges = [...ages];
    nextAges[index] = age;
    onChange({ childrenAges: nextAges });
  };

  const handleDestinationChange = (nextDestination: string) => {
    const trimmed = nextDestination.trim();
    if (!trimmed) {
      onChange({
        travelDestination: nextDestination,
        packageMode: undefined,
      });
      return;
    }
    onChange({ travelDestination: nextDestination });
  };

  const handlePackageModeChange = (mode: LeadPackageMode) => {
    if (mode === "PRE_BUILT") {
      onChange({ packageMode: mode, ...PRE_BUILT_CLEARED_FIELDS });
      return;
    }
    onChange({ packageMode: mode });
  };

  return (
    <section className="crm-lead-drawer__section">
      <h3 className="crm-lead-drawer__section-title">Details</h3>

      <div className="crm-lead-details__grid">
        <div className="crm-lead-details__full">
          <FieldLabel htmlFor={`lead-destination-${leadId}`}>Destination</FieldLabel>
          <input
            id={`lead-destination-${leadId}`}
            type="text"
            value={value.travelDestination ?? ""}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="crm-lead-drawer__input w-full"
          />
        </div>

        {hasDestination ? (
          <div className="crm-lead-details__full crm-lead-details__package-mode">
            <RadioGroup
              name={`lead-package-mode-${leadId}`}
              legend="Package type"
              value={value.packageMode}
              onChange={handlePackageModeChange}
              options={[
                { value: "PRE_BUILT", label: "Pre-built package" },
                { value: "CUSTOM", label: "Custom package" },
              ]}
            />
            {isPreBuilt ? (
              <p className="crm-lead-details__package-hint">
                Flight, transport, insurance, occasion, and hotel category are set by the package.
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor={`lead-travel-date-${leadId}`}>Travel date</FieldLabel>
          <DatePickerInput
            id={`lead-travel-date-${leadId}`}
            value={value.travelDate ?? ""}
            onChange={(e) => onChange({ travelDate: e.target.value || undefined })}
            inputClassName="crm-lead-drawer__input w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`lead-arrival-date-${leadId}`}>Arrival date</FieldLabel>
          <DatePickerInput
            id={`lead-arrival-date-${leadId}`}
            value={value.arrivalDate ?? ""}
            onChange={(e) => onChange({ arrivalDate: e.target.value || undefined })}
            inputClassName="crm-lead-drawer__input w-full"
          />
        </div>

        <div className="crm-lead-details__full">
          <FieldLabel htmlFor={`lead-addr1-${leadId}`}>Address line 1</FieldLabel>
          <input
            id={`lead-addr1-${leadId}`}
            type="text"
            value={value.addressLine1 ?? ""}
            onChange={(e) => onChange({ addressLine1: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>
        <div className="crm-lead-details__full">
          <FieldLabel htmlFor={`lead-addr2-${leadId}`}>Address line 2</FieldLabel>
          <input
            id={`lead-addr2-${leadId}`}
            type="text"
            value={value.addressLine2 ?? ""}
            onChange={(e) => onChange({ addressLine2: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>

        <div>
          <FieldLabel htmlFor={`lead-city-${leadId}`}>City</FieldLabel>
          <input
            id={`lead-city-${leadId}`}
            type="text"
            value={value.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`lead-pincode-${leadId}`}>Pincode</FieldLabel>
          <input
            id={`lead-pincode-${leadId}`}
            type="text"
            value={value.pincode ?? ""}
            onChange={(e) => onChange({ pincode: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`lead-state-${leadId}`}>State</FieldLabel>
          <input
            id={`lead-state-${leadId}`}
            type="text"
            value={value.state ?? ""}
            onChange={(e) => onChange({ state: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`lead-country-${leadId}`}>Country</FieldLabel>
          <input
            id={`lead-country-${leadId}`}
            type="text"
            value={value.country ?? ""}
            onChange={(e) => onChange({ country: e.target.value })}
            className="crm-lead-drawer__input w-full"
          />
        </div>

        <div>
          <FieldLabel htmlFor={`lead-adults-${leadId}`}>Number of adults</FieldLabel>
          <input
            id={`lead-adults-${leadId}`}
            type="number"
            min={0}
            max={99}
            value={value.adultsCount ?? ""}
            onChange={(e) =>
              onChange({
                adultsCount: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="crm-lead-drawer__input w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`lead-children-${leadId}`}>Number of children</FieldLabel>
          <input
            id={`lead-children-${leadId}`}
            type="number"
            min={0}
            max={20}
            value={value.childrenCount ?? ""}
            onChange={(e) =>
              setChildCount(e.target.value === "" ? 0 : Number(e.target.value))
            }
            className="crm-lead-drawer__input w-full"
          />
        </div>

        {childCount > 0 ? (
          <div className="crm-lead-details__full crm-lead-details__child-ages">
            <span className="crm-lead-drawer__field-label">Children ages</span>
            <div className="crm-lead-details__child-ages-grid">
              {Array.from({ length: childCount }, (_, index) => (
                <div key={index}>
                  <FieldLabel htmlFor={`lead-child-age-${leadId}-${index}`}>
                    Child {index + 1}
                  </FieldLabel>
                  <input
                    id={`lead-child-age-${leadId}-${index}`}
                    type="number"
                    min={0}
                    max={17}
                    value={ages[index] ?? ""}
                    onChange={(e) =>
                      setChildAge(
                        index,
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    className="crm-lead-drawer__input w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor={`lead-travel-type-${leadId}`}>Type of travel</FieldLabel>
          <select
            id={`lead-travel-type-${leadId}`}
            value={value.travelType ?? ""}
            onChange={(e) =>
              onChange({
                travelType: (e.target.value || undefined) as LeadDetailsFields["travelType"],
              })
            }
            className="crm-lead-drawer__select w-full"
          >
            <option value="">Select…</option>
            <option value="SOLO">Solo</option>
            <option value="FAMILY">Family</option>
            <option value="MISC">Misc</option>
          </select>
        </div>

        {!hidePreBuiltFields ? (
          <div>
            <FieldLabel htmlFor={`lead-hotel-${leadId}`}>Hotel category</FieldLabel>
            <select
              id={`lead-hotel-${leadId}`}
              value={value.hotelCategory ?? ""}
              onChange={(e) =>
                onChange({
                  hotelCategory: (e.target.value || undefined) as LeadDetailsFields["hotelCategory"],
                })
              }
              className="crm-lead-drawer__select w-full"
            >
              <option value="">Select…</option>
              <option value="3_STAR">3 star</option>
              <option value="4_STAR">4 star</option>
              <option value="5_STAR">5 star</option>
            </select>
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor={`lead-meal-${leadId}`}>Meal category</FieldLabel>
          <select
            id={`lead-meal-${leadId}`}
            value={value.mealCategory ?? ""}
            onChange={(e) =>
              onChange({
                mealCategory: (e.target.value || undefined) as LeadDetailsFields["mealCategory"],
              })
            }
            className="crm-lead-drawer__select w-full"
          >
            <option value="">Select…</option>
            <option value="VEG">Veg</option>
            <option value="NON_VEG">Non-Veg</option>
            <option value="JAIN">Jain</option>
          </select>
        </div>

        {!hidePreBuiltFields ? (
          <div>
            <FieldLabel htmlFor={`lead-occasion-${leadId}`}>Occasion</FieldLabel>
            <select
              id={`lead-occasion-${leadId}`}
              value={value.occasion ?? ""}
              onChange={(e) =>
                onChange({
                  occasion: (e.target.value || undefined) as LeadDetailsFields["occasion"],
                })
              }
              className="crm-lead-drawer__select w-full"
            >
              <option value="">Select…</option>
              <option value="ANNIVERSARY">Anniversary</option>
              <option value="BIRTHDAY_PARTY">Birthday Party</option>
              <option value="MARRIAGE">Marriage</option>
              <option value="RETIREMENT">Retirement</option>
              <option value="NONE">None</option>
            </select>
          </div>
        ) : null}

        <div className="crm-lead-details__full crm-lead-details__subsection">
          <span className="crm-lead-drawer__field-label">Travel preferences</span>
        </div>

        {!hidePreBuiltFields ? (
          <div className="crm-lead-details__radio-cell">
            <RadioGroup
              name={`lead-flight-${leadId}`}
              legend="Flights type"
              value={value.flightType}
              onChange={(next) => onChange({ flightType: next })}
              options={[
                { value: "ONE_WAY", label: "One-way" },
                { value: "ROUND", label: "Round" },
              ]}
            />
          </div>
        ) : null}

        {!hidePreBuiltFields ? (
          <div className="crm-lead-details__radio-cell">
            <RadioGroup
              name={`lead-transport-${leadId}`}
              legend="Transportation"
              value={value.transportation}
              onChange={(next) => onChange({ transportation: next })}
              options={[
                { value: "PVT", label: "Pvt" },
                { value: "SIC", label: "SIC" },
              ]}
            />
          </div>
        ) : null}

        <div className="crm-lead-details__radio-cell">
          <YesNoRadio
            name={`lead-baggage-${leadId}`}
            legend="Extra baggage"
            value={value.extraBaggage}
            onChange={(next) => onChange({ extraBaggage: next })}
          />
        </div>

        <div className="crm-lead-details__radio-cell">
          <YesNoRadio
            name={`lead-wheelchair-${leadId}`}
            legend="Wheelchair assistance"
            value={value.wheelchairAssistance}
            onChange={(next) => onChange({ wheelchairAssistance: next })}
          />
        </div>

        <div className="crm-lead-details__radio-cell">
          <YesNoRadio
            name={`lead-visa-${leadId}`}
            legend="Visa assistance"
            value={value.visaAssistance}
            onChange={(next) => onChange({ visaAssistance: next })}
          />
        </div>

        {!hidePreBuiltFields ? (
          <div className="crm-lead-details__radio-cell">
            <YesNoRadio
              name={`lead-insurance-${leadId}`}
              legend="Travel insurance"
              value={value.travelInsurance}
              onChange={(next) => onChange({ travelInsurance: next })}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
