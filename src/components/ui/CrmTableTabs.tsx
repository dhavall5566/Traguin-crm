'use client';

import React from 'react';

export type CrmTableTab = {
  id: string;
  label: string;
};

type CrmTableTabsProps = {
  tabs: CrmTableTab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
};

export function CrmTableTabs({ tabs, activeTab, onChange, className = '' }: CrmTableTabsProps) {
  return (
    <div className={`crm-table-tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`crm-table-tabs__btn ${isActive ? 'crm-table-tabs__btn--active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
