'use client';

import { SettingsPageContent } from '@/components/settings/SettingsPageContent';
import { SettingsTabProvider, type SettingsTab } from '@/components/settings/SettingsTabContext';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export function SettingsShell({ initialTab }: { initialTab: SettingsTab }) {
  return (
    <SettingsTabProvider initialTab={initialTab}>
      <SettingsTabs />
      <SettingsPageContent />
    </SettingsTabProvider>
  );
}
