'use client';

import React from 'react';
import { CrmTableTabs, type CrmTableTab } from '@/components/ui/CrmTableTabs';

type CrmTablePanelProps = {
  children: React.ReactNode;
  tabs?: CrmTableTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
};

/** White rounded table container matching the Traguin CRM reference layout. */
export function CrmTablePanel({
  children,
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: CrmTablePanelProps) {
  return (
    <div className={`crm-table-panel ${className}`.trim()}>
      {tabs && tabs.length > 0 && activeTab && onTabChange ? (
        <CrmTableTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      ) : null}
      {children}
    </div>
  );
}
