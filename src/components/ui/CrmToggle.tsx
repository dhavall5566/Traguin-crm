'use client';

import React from 'react';

type CrmToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
};

export function CrmToggle({ checked, onChange, label, disabled, id }: CrmToggleProps) {
  return (
    <div className={`crm-toggle ${disabled ? 'crm-toggle--disabled' : ''}`}>
      {label ? (
        <span className="crm-toggle__label" id={id ? `${id}-label` : undefined}>
          {label}
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label && id ? `${id}-label` : undefined}
        disabled={disabled}
        className={`crm-toggle__track ${checked ? 'crm-toggle__track--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="crm-toggle__thumb" aria-hidden />
      </button>
    </div>
  );
}
