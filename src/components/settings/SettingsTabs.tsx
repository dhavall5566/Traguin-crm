'use client';

import { useSettingsTab, type SettingsTab } from '@/components/settings/SettingsTabContext';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'smtp', label: 'SMTP' },
];

export function SettingsTabs() {
  const { tab, setTab } = useSettingsTab();

  return (
    <div className="crm-staff-tabs" role="tablist" aria-label="Workspace settings">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={`crm-staff-tabs__btn ${tab === item.id ? 'crm-staff-tabs__btn--active' : ''}`}
          onClick={() => setTab(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
